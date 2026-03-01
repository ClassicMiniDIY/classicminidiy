export interface ArchiveCard {
  title: string;
  description: string;
  image: string;
  link: string;
  disabled: boolean;
}

export interface Post {
  title?: string;
  path?: string;
  image?: string;
  author?: string;
  date?: string;
  description?: string;
  slug?: string;
  code?: string;
  download?: string;
}

export interface ArchiveItem {
  companyName: string;
  link: string;
  image: string;
}
