import { Url } from 'types';

export interface VxTwitterAPIResponse {
  communityNode: null;
  conversationID: `${number}`;
  date: string;
  date_epoch: number;
  hashtags: string[];
  likes: number;
  mediaURLs: string[];
  media_extended: MediaInfo[];
  possibly_sensitive: boolean;
  qrtURL: Url | null;
  replies: number;
  retweets: number;
  text: string;
  tweetID: `${number}`;
  tweetURL: Url;
  user_name: string;
  user_profile_image_url: Url;
  user_screen_name: string;
};

export interface MediaInfo {
  altText: string | null;
  size: { height: number; width: number };
  thumbnail_url: Url;
  type: 'image' | 'video';
  url: Url;
}
