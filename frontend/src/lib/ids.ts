// UUIDs come from the functions Expo installs on `globalThis.expo` in every app (natively
// on phones, with Expo's own polyfill on web and in jest-expo). That's what Expo's internal
// `uuid` helper calls too; going through the global avoids importing expo-modules-core,
// which isn't a direct dependency.

type ExpoUuid = { uuidv4: () => string; uuidv5: (name: string, namespace: string) => string };

function expoUuid(): ExpoUuid {
  const expo = (globalThis as { expo?: Partial<ExpoUuid> }).expo;
  if (!expo?.uuidv4 || !expo.uuidv5) throw new Error('Expo’s UUID functions are not installed');
  return expo as ExpoUuid;
}

/** A new row id. Every row is created with an id made on the phone, so offline rows keep it. */
export function newId(): string {
  return expoUuid().uuidv4();
}

/** A UUIDv5, the same as Python's uuid.uuid5(UUID(namespace), name). Used for ids the server
 * derives too, like preset days: derivedId(splitId, "day:0"). */
export function derivedId(namespace: string, name: string): string {
  return expoUuid().uuidv5(name, namespace);
}
