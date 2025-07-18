module.exports = {
  collectCoverage: true,
  coverageDirectory: "coverage",
  testEnvironment: "node",
  collectCoverageFrom: [
    "src/**/*.js",
    "!**/node_modules/**",
    "!**/__tests__/**",
    "!**/coverage/**",
    "!**/logs/**",    "!**/data/**",
    "!ecosystem.config.js",
    "!jest.setup.js"
  ],
  // Use the Jest setup file
  setupFilesAfterEnv: ['./jest.setup.js'],
  // Use v8 coverage provider for better reporting
  coverageProvider: "v8",
  // Configure coverage thresholds
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50
    },
    // Apply consistent thresholds to all service files
    "src/services/*.js": {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50
    },
    // Allow slightly lower thresholds for utility files
    "src/utils/*.js": {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50
    }
  },
  // Output verbose coverage info
  verbose: true,
  // Configure JUnit reporter with enhanced settings
  reporters: [
    "default",
    ["jest-junit", {
      outputDirectory: "./test-results",
      outputName: "junit.xml",
      classNameTemplate: "{classname}",
      titleTemplate: "{classname} {title}",
      ancestorSeparator: " ",
      usePathForSuiteName: "true"
    }]
  ],
  testMatch: [
    "**/__tests__/**/*.test.js?(x)",
    "**/?(*.)+(spec|test).js?(x)"
  ]
};
