import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { hashPassword } from "../lib/auth";
import { prisma } from "../lib/prisma";

function readHidden(prompt: string) {
  if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
    throw new Error("Run this command in an interactive PowerShell terminal.");
  }

  return new Promise<string>((resolve, reject) => {
    let value = "";
    const finish = (error?: Error) => {
      stdin.removeListener("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    };
    const onData = (input: Buffer | string) => {
      for (const character of input.toString()) {
        if (character === "\u0003") {
          finish(new Error("Password reset cancelled."));
          return;
        }
        if (character === "\r" || character === "\n") {
          finish();
          return;
        }
        if (character === "\u0008" || character === "\u007f") {
          value = Array.from(value).slice(0, -1).join("");
          continue;
        }
        if (character >= " " && character !== "\u007f") value += character;
      }
    };

    stdout.write(prompt);
    stdin.setEncoding("utf8");
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
  });
}

async function main() {
  const readline = createInterface({ input: stdin, output: stdout });
  const username = (await readline.question("Username to reset: ")).trim();
  if (!username) {
    readline.close();
    throw new Error("A username is required.");
  }
  const confirmation = await readline.question(`Type RESET ${username} to confirm: `);
  readline.close();
  if (confirmation !== `RESET ${username}`) throw new Error("Confirmation did not match. No password was changed.");

  const employee = await prisma.employee.findUnique({
    where: { username },
    select: { id: true },
  });
  if (!employee) throw new Error(`No account was found for "${username}".`);

  const password = await readHidden("New password (8-128 characters, hidden): ");
  if (password.length < 8 || password.length > 128) {
    throw new Error("Password must be between 8 and 128 characters. No password was changed.");
  }
  const confirmationPassword = await readHidden("Confirm new password (hidden): ");
  if (password !== confirmationPassword) throw new Error("Passwords did not match. No password was changed.");

  await prisma.employee.update({
    where: { id: employee.id },
    data: { passwordHash: await hashPassword(password) },
  });
  console.info(`Password updated for ${username}. Sign in using the new password.`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Could not reset the account password.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
