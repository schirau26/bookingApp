import type { NavigatorScreenParams } from '@react-navigation/native';

export type HomeStackParamList = {
  WashHome: undefined;
};

export type BookingsStackParamList = {
  MyBookings: undefined;
};

export type InboxStackParamList = {
  Notifications: undefined;
};

export type ProfileStackParamList = {
  Profile: undefined;
};

export type CustomerTabParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList>;
  BookingsTab: NavigatorScreenParams<BookingsStackParamList>;
  InboxTab: NavigatorScreenParams<InboxStackParamList>;
  ProfileTab: NavigatorScreenParams<ProfileStackParamList>;
};

export type CustomerRootParamList = {
  CustomerTabs: NavigatorScreenParams<CustomerTabParamList>;
  Book: { packageId?: string };
  ReviewForm: { businessId: string; bookingId?: string; reviewId?: string };
  Invoice: { bookingId: string };
};

export type OwnerHomeStackParamList = {
  OwnerQueue: undefined;
};

export type OwnerManageStackParamList = {
  ManageBusiness: undefined;
};

export type OwnerTabParamList = {
  HomeTab: NavigatorScreenParams<OwnerHomeStackParamList>;
  ManageTab: NavigatorScreenParams<OwnerManageStackParamList>;
  InboxTab: NavigatorScreenParams<InboxStackParamList>;
  ProfileTab: NavigatorScreenParams<ProfileStackParamList>;
};

export type OwnerRootParamList = {
  OwnerTabs: NavigatorScreenParams<OwnerTabParamList>;
  ServiceForm: { businessId: string; serviceId?: string };
  OwnerReviews: { businessId: string };
  Invoice: { bookingId: string };
};
