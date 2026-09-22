export type CustomerStackParamList = {
  Discover: undefined;
  BusinessDetail: { businessId: string };
};

export type OwnerStackParamList = {
  MyBusinesses: undefined;
  BusinessForm: { businessId?: string };
  ManageBusiness: { businessId: string };
  ServiceForm: { businessId: string; serviceId?: string };
};

export type AdminStackParamList = {
  AdminHome: undefined;
};
