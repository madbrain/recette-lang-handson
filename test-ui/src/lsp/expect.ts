export function wrap<T>(description: string, runner: () => void) {
  try {
    runner();
  } catch (e) {
    e.description = description;
    throw e;
  }
}
