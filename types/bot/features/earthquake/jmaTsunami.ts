export interface JMATsunami {
  _id: string;
  id: string;
  code: 552;
  time: string;
  cancelled: boolean;
  issue: Issue;
  areas?: Area[];
}

interface Issue {
  source: string;
  time: string;
  type: 'Focus';
}

interface Area {
  grade?: string;
  immediate?: boolean;
  name?: string;
}
