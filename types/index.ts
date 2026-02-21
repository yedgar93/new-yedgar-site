export interface Release {
  id: string;
  title: string;
  type: "EP" | "Single" | "Album" | "Remix" | "Mix";
  releaseDate: string;
  label?: string;
  featured?: boolean;
  spotifyUrl?: string;
  soundcloudUrl?: string;
  bandcampUrl?: string;
  color?: string;
  artwork?: string;
  tracks?: number;
}

export interface Show {
  id: string;
  title: string;
  venue: string;
  location: string;
  date: string;
  time?: string;
  ticketUrl?: string;
  status: "upcoming" | "past" | "cancelled";
}

export interface SocialLink {
  platform: string;
  url: string;
  label: string;
}

export interface SiteMetadata {
  artist: string;
  tagline: string;
  location: string;
  bio: string;
  email: string;
  socialLinks: SocialLink[];
}
