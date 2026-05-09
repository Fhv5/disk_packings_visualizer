export type Coordinate = number | string;
export type ContactPair = [number, number];

export interface ContactClassJSON {
  discos: number;
  nombre?: string;
  centros: Coordinate[][];
  contactos: ContactPair[];
}

export interface PackingFileJSON {
  version: string;
  indexing: '0-based' | '1-based';
  angles: string;
  radius: string;
  graphs: ContactClassJSON[];
}

export interface ParsedContactClass {
  id: string;
  disksCount: number;
  centers: [number, number][];
  contacts: [number, number][];
  dof: number;
  fileName: string;
}

export interface ParsedFile {
  fileName: string;
  version: string;
  contactClasses: ParsedContactClass[];
}
