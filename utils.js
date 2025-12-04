import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, ".data");
const ipPath = path.join(dataDir, "last_ip_ironDNS.txt");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const log = (msg) => {
  const time = new Date().toISOString().replace("T", " ").substring(0, 19);
  console.log(`[${time}] ${msg}`);
};

export const getCurrentIP = async (ipService) => {
  const res = await fetch(ipService);
  return res.text();
};

export const loadLastIP = () => {
  return fs.existsSync(ipPath) ? fs.readFileSync(ipPath, "utf-8") : null;
};

export const saveCurrentIP = (ip) => {
  fs.writeFileSync(ipPath, ip);
};

export const getCurrentIPv6 = async (ipService6) => {
  const res = await fetch(ipService6);
  return res.text();
};