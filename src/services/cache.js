// services/cache.js

let client = null;

// Try to load redis safely
try {
  const redis = require('redis');

  client = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  });

  client.connect().catch(err => {
    console.warn('⚠️ Redis not available, cache disabled');
    client = null;
  });

} catch (err) {
  console.warn('⚠️ Redis module not installed, cache disabled');
}

async function get(key) {
  if (!client) return null;

  try {
    return await client.get(key);
  } catch {
    return null;
  }
}

async function setEx(key, ttl, value) {
  if (!client) return;

  try {
    await client.setEx(key, ttl, value);
  } catch {}
}

async function del(key) {
  if (!client) return;

  try {
    await client.del(key);
  } catch {}
}

module.exports = {
  get,
  setEx,
  del
};