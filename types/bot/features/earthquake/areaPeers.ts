export interface AreaPeers {
  _id: string;
  id: string;
  code: 555;
  time: string;
  areas: Area[];
}

interface Area {
  id: number;
  peer: number;
}
