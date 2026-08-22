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
const QUALITY = 0.8;

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

async function render(source: ImageBitmap, maxEdge: number, type: string): Promise<Blob> {
  const { width, height } = scaleTo(source.width, source.height, maxEdge);
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d') as
    | OffscreenCanvasRenderingContext2D
    | CanvasRenderingContext2D
    | null;

  if (!context) throw new Error('Não foi possível processar a imagem neste aparelho.');

  context.drawImage(source, 0, 0, width, height);
  return canvasToBlob(canvas, type, QUALITY);
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

/** URL temporária para pré-visualizar um Blob guardado localmente. */
export function previewUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}
