export function wrap<T>(description: string, runner: () => void) {
  try {
    runner();
  } catch (e) {
    e.description = description;
    throw e;
  }
}

export async function asyncWrap<T>(description: string, runner: () => Promise<T>) {
  try {
    await runner();
  } catch (e) {
    e.description = description;
    throw e;
  }
}