export type CustomerStackParamList = {
  Discover: undefined;
  BusinessDetail: { businessId: string };
  Book: { businessId: string; serviceId: string };
  MyBookings: undefined;
};

export type OwnerStackParamList = {
  MyBusinesses: undefined;
  BusinessForm: { businessId?: string };
  ManageBusiness: { businessId: string };
  ServiceForm: { businessId: string; serviceId?: string };
  OwnerBookings: { businessId: string };
};

export type AdminStackParamList = {
  AdminHome: undefined;
};
