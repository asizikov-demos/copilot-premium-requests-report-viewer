interface FileChunk {
  content: string;
}

export class MockFileReader {
  onload: ((event: { target: { result: string } }) => void) | null = null;

  readAsText(chunk: FileChunk): void {
    this.onload?.({ target: { result: chunk.content } });
  }
}

export function createStreamingFile(content: string): File {
  const file = new File([content], 'test-usage.csv');
  Object.defineProperties(file, {
    size: { value: content.length },
    slice: { value: (start = 0, end = content.length) => ({ content: content.slice(start, end) }) },
  });
  return file;
}
