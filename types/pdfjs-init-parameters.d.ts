import 'pdfjs-dist/types/src/display/api';

declare module 'pdfjs-dist/types/src/display/api' {
  interface DocumentInitParameters {
    isEvalSupported?: boolean;
  }
}
