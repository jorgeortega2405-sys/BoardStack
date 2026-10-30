import { ZipArchive } from 'archiver';

export function createZipBuffer(files: Array<{ buffer: Buffer; name: string }>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archive = new ZipArchive({ zlib: { level: 9 } });
    const chunks: Buffer[] = [];

    archive.on('data', (chunk: Buffer) => chunks.push(chunk));
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    archive.on('error', (err: unknown) => reject(err));

    for (const f of files) {
      archive.append(f.buffer, { name: f.name });
    }

    void archive.finalize();
  });
}
