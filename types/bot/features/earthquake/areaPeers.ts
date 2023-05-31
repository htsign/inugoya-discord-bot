export interface AreaPeers {
  id: string;
  code: 555;
  time: string;
  areas: Area[];
}

interface Area {
  id: number;
  peer: number;
}
