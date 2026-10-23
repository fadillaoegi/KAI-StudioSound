export const serverStorage = import.meta.env.MODE === 'hostinger';
export const storageDescription = serverStorage
  ? 'Audio disimpan di server dan bisa didengarkan pengunjung lain.'
  : 'Audio tersimpan di browser perangkat ini.';
