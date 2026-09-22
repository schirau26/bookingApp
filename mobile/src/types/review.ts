export type PublicReview = {
  id: string;
  rating: number;
  body: string;
  replyBody: string | null;
  repliedAt: string | null;
  createdAt: string;
  authorName: string;
  photos: { id: string; url: string }[];
  reportedByMe?: boolean;
};

export function formatStars(rating: number) {
  return `${rating} / 5`;
}
