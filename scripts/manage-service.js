/**
 * Service Manager CLI Entrypoint
 * Delegasi ke src/service/manager.js
 */
const { runServiceCommand } = require('../src/service/manager');

const command = process.argv[2] || 'status';
runServiceCommand(command);
