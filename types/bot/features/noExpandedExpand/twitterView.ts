export namespace TweetDetail {
  type PhotoSize = 'large' | 'medium' | 'small' | 'orig';

  export interface Media<MediaType extends string = 'photo'> {
    display_url: string;
    expanded_url: string;
    id_str: string;
    indices: [number, number];
    media_url_https: string;
    type: MediaType;
    url: string;
    features: { [K in PhotoSize]: { faces: any[] } };
    sizes: { [K in PhotoSize]: { h: number, w: number, resize: string } };
    original_info: { height: number, width: number, focus_rects: Array<{ x: number, y: number, w: number, h: number }> };
  }

  export type ExtendedMedia = ExtendedPhoto | ExtendedVideo;

  interface ExtendedMediaBase<MediaType extends string> extends Media<MediaType> {
    media_key: string;
    ext_media_availability: { status: string };
  }

  export interface ExtendedPhoto extends ExtendedMediaBase<'photo'> {}

  export interface ExtendedVideo extends ExtendedMediaBase<'video'> {
    additional_media_info: { monetizable: boolean };
    mediaStats: { viewCount: number };
    video_info: VideoInfo;
  }

  export interface Url {
    display_url: string;
    expanded_url: string;
    url: string;
    indices: [number, number];
  }

  interface VideoInfo {
    aspect_ratio: [number, number];
    duration_millis: number;
    variants: VideoVariant[];
  }

  interface VideoVariant {
    bitrate?: number;
    content_type: string;
    url: string;
  }
}

export interface TweetInfo {
  user: string;
  userPic: string;
  tweet: string;
  pics: string[];
  vids?: { url: string, key: string }[];
  timestamp: string;
  likes: number;
  retweets: number;
}
