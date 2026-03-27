export function deepFreezeObject<T>(input: T): T {
  if (input && typeof input === "object") {
    Object.freeze(input)
    for (const key of Object.keys(input as Record<string, unknown>)) {
      const value = (input as Record<string, unknown>)[key]
      if (value && typeof value === "object" && !Object.isFrozen(value)) {
        deepFreezeObject(value)
      }
    }
  }
  return input
}
