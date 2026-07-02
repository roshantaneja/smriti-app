// Jest global setup: mock native storage so the zustand store can be imported
// in tests without a device.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
