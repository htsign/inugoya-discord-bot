export namespace TweetDetail {
  type PhotoSize = 'large' | 'medium' | 'small' | 'orig';

  export interface Media {
    display_url: string;
    expanded_url: string;
    id_str: string;
    indices: [number, number];
    media_url_https: string;
    type: 'photo';
    url: string;
    features: { [K in PhotoSize]: { faces: any[] } };
    sizes: { [K in PhotoSize]: { h: number, w: number, resize: string } };
    original_info: { height: number, width: number, focus_rects: Array<{ x: number, y: number, w: number, h: number }> };
  }

  export interface Url {
    display_url: string;
    expanded_url: string;
    url: string;
    indices: [number, number];
  }
}

export interface TweetInfo {
  user: string;
  userPic: string;
  tweet: string;
  pics: string[];
  timestamp: string;
  likes: number;
  retweets: number;
}
