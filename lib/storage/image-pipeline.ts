/**
 * Preparo da foto antes do upload.
 *
 * Um celular moderno gera arquivos de 4 a 8 MB. Subir isso todo dia consome
 * dados do usuário, enche o storage e deixa o calendário lento. Aqui a imagem
 * é reorientada, redimensionada e convertida para WebP antes de sair do
 * aparelho — costuma sair por volta de 150 KB.
 *
 * O corpo da pessoa não é alterado: só resolução e formato mudam.
 */

export type ProcessedImage = {
  blob: Blob;
  thumbnail: Blob;
  width: number;
  height: number;
};

const MAX_EDGE = 1440;
const THUMB_EDGE = 320;
const QUALITY = 0.82;

/**
 * Teto de tamanho da foto grande.
 *
 * O tamanho de um arquivo comprimido depende do conteúdo, não só da resolução:
 * uma foto com muita textura — cabelo, tecido estampado, fundo cheio — sai
 * várias vezes maior que uma parede lisa no mesmo 1440px. Sem um teto, é
 * exatamente a foto de celular boa que enche o storage.
 *
 * 400 KB numa imagem de 1440px é qualidade de sobra para comparar corpo; o
 * limite só entra em ação quando a qualidade padrão não coube.
 */
const TARGET_BYTES = 400 * 1024;

/** Qualidades tentadas em ordem, até caber no teto. Nenhuma reduz resolução. */
const QUALITY_STEPS = [QUALITY, 0.72, 0.62, 0.55];

function scaleTo(width: number, height: number, maxEdge: number) {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const ratio = maxEdge / longest;
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
}

type Canvas = OffscreenCanvas | HTMLCanvasElement;

function createCanvas(width: number, height: number): Canvas {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

async function canvasToBlob(canvas: Canvas, type: string, quality: number): Promise<Blob> {
  if ('convertToBlob' in canvas) {
    return canvas.convertToBlob({ type, quality });
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Não foi possível processar a imagem.'))),
      type,
      quality,
    );
  });
}

/**
 * Comprime até caber no teto, sem mexer na resolução.
 *
 * Reduzir qualidade preserva a nitidez das bordas — que é o que se olha numa
 * foto de progresso — enquanto reduzir resolução destruiria justamente isso.
 */
async function comprimir(canvas: Canvas, type: string, teto: number): Promise<Blob> {
  let ultimo: Blob | null = null;

  for (const quality of QUALITY_STEPS) {
    const blob = await canvasToBlob(canvas, type, quality);
    ultimo = blob;
    if (blob.size <= teto) return blob;
  }

  // JPEG/WebP sempre devolvem alguma coisa; o último é o menor que conseguimos
  return ultimo as Blob;
}

async function render(source: ImageBitmap, maxEdge: number, type: string): Promise<Blob> {
  const { width, height } = scaleTo(source.width, source.height, maxEdge);
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d') as
    | OffscreenCanvasRenderingContext2D
    | CanvasRenderingContext2D
    | null;

  if (!context) throw new Error('Não foi possível processar a imagem neste aparelho.');

  context.drawImage(source, 0, 0, width, height);

  // a miniatura já é pequena por definição; o teto vale para a foto grande
  return maxEdge === THUMB_EDGE
    ? canvasToBlob(canvas, type, QUALITY)
    : comprimir(canvas, type, TARGET_BYTES);
}

/** WebP é o padrão; AVIF não é gerado pelo canvas em todos os navegadores. */
async function pickType(): Promise<string> {
  try {
    const probe = createCanvas(1, 1);
    const blob = await canvasToBlob(probe, 'image/webp', 0.5);
    return blob.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
  } catch {
    return 'image/jpeg';
  }
}

/**
 * `createImageBitmap` já aplica a orientação do EXIF quando pedimos
 * `imageOrientation: 'from-image'` — a foto tirada de lado chega em pé.
 */
export async function processPhoto(file: File | Blob): Promise<ProcessedImage> {
  if (file.size > 25 * 1024 * 1024) {
    throw new Error('Esta imagem é grande demais. Tente uma foto menor que 25 MB.');
  }

  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });

  try {
    const type = await pickType();
    const { width, height } = scaleTo(bitmap.width, bitmap.height, MAX_EDGE);

    const [blob, thumbnail] = await Promise.all([
      render(bitmap, MAX_EDGE, type),
      render(bitmap, THUMB_EDGE, type),
    ]);

    return { blob, thumbnail, width, height };
  } finally {
    bitmap.close();
  }
}

const AVATAR_EDGE = 512;

/**
 * Foto de perfil: recorte quadrado pelo centro.
 *
 * O avatar aparece sempre num círculo. Redimensionar sem recortar deixaria a
 * imagem esticada ou com faixas — recortar pelo centro é o que a pessoa espera
 * ao ver a própria foto num círculo.
 */
export async function processAvatar(file: File | Blob): Promise<{ blob: Blob; size: number }> {
  if (file.size > 25 * 1024 * 1024) {
    throw new Error('Esta imagem é grande demais. Tente uma foto menor que 25 MB.');
  }

  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });

  try {
    const edge = Math.min(bitmap.width, bitmap.height);
    const offsetX = (bitmap.width - edge) / 2;
    const offsetY = (bitmap.height - edge) / 2;

    const canvas = createCanvas(AVATAR_EDGE, AVATAR_EDGE);
    const context = canvas.getContext('2d') as
      | OffscreenCanvasRenderingContext2D
      | CanvasRenderingContext2D
      | null;

    if (!context) throw new Error('Não foi possível processar a imagem neste aparelho.');

    context.drawImage(bitmap, offsetX, offsetY, edge, edge, 0, 0, AVATAR_EDGE, AVATAR_EDGE);

    const type = await pickType();
    const blob = await canvasToBlob(canvas, type, QUALITY);

    // o bucket recusa acima de 512 KB; com WebP a 512px isso não costuma acontecer
    if (blob.size > 512 * 1024) {
      const menor = await canvasToBlob(canvas, type, 0.6);
      return { blob: menor, size: menor.size };
    }

    return { blob, size: blob.size };
  } finally {
    bitmap.close();
  }
}

/** URL temporária para pré-visualizar um Blob guardado localmente. */
export function previewUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}
