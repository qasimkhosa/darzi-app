export type AuthStackParamList = {
  AuthHome: undefined;
};

export type CustomerTabParamList = {
  Discover: undefined;
  Feed: { darziId?: number } | undefined;
  Orders: undefined;
  Profile: undefined;
};

export type ProfileStackParamList = {
  ProfileHome: undefined;
  NewOrder: undefined;
  ShowcaseUpload: undefined;
};

export type RootStackParamList = {
  LanguageSelect: undefined;
  Onboarding: undefined;
  Auth: undefined;
  CustomerTabs: undefined;
};
