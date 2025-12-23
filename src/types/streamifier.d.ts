declare module 'streamifier' {
  import { Readable } from 'stream';
  function createReadStream(buffer: Buffer | Uint8Array): Readable;
  const streamifier: {
    createReadStream: typeof createReadStream;
  };
  export = streamifier;
}
