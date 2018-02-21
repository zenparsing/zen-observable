export function parse(string) {
  return new Observable(async observer => {
    await null;
    observer.start();
    for (let char of string) {
      if (observer.closed) return;
      else if (char !== '-') observer.next(char);
      await null;
    }
    observer.complete();
  });
}
