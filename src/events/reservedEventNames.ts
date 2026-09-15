/**
 * Event names whose generated wrapper would shadow a built-in SDK
 * method. Wrappers are named `report<Name>` with no infix, so a custom
 * event called `ButtonClick` would produce `reportButtonClick` and
 * collide with the real one - silently on the web (the generated
 * function wins the import) or as a compile error elsewhere. Rejected
 * at parse time so the failure is loud and named. The list is the union
 * of every SDK's public `report*` surface and must grow with it.
 */
const RESERVED_EVENT_NAMES: ReadonlySet<string> = new Set([
  'ABTestGroupAssignment',
  'AdItemsGranted',
  'AdOffered',
  'AdRevenue',
  'ButtonClick',
  'CustomEvent',
  'DeepLink',
  'GameLanguage',
  'InAppPurchase',
  'InAppPurchaseItemsGranted',
  'InstallCampaign',
  'ItemsExchange',
  'ItemsReset',
  'OnboardingMilestone',
  'SceneLoaded',
  'SceneUnloaded',
  'SubscriptionItemsGranted',
  'SubscriptionRevenue',
  'UserBatch',
  'UserRegisteredBeforeSDKIntegration',
  'WindowClose',
  'WindowOpen',
]);

export { RESERVED_EVENT_NAMES };
