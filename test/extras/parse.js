export function parse(string) {
  return new Observable(observer => {
    (async () => {
      await null;
      for (let char of string) {
        if (observer.closed) return;
        else if (char !== '-') observer.next(char);
        await null;
      }
      observer.complete();
    })();
  });
}
