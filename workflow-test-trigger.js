// This file is for testing the GitHub Actions workflow
// It should trigger the workflow when committed

const triggerDate = new Date();
console.log(`Workflow test triggered at ${triggerDate.toISOString()}`);
