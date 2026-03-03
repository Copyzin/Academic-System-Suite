import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { api } from "@shared/routes";
import { storage } from "./storage";
import { User } from "@shared/schema";

const scryptAsync = promisify(scrypt);

const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const loginAttempts = new Map<string, { count: number; firstAttemptAt: number }>();

function sanitizeUser(user: User) {
  const { password, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

function normalizeIdentifier(value: string) {
  return value.trim().toLowerCase();
}

function buildAttemptKey(ip: string, identifier: string) {
  return `${ip}:${normalizeIdentifier(identifier)}`;
}

function isBlockedByRateLimit(key: string) {
  const data = loginAttempts.get(key);
  if (!data) return false;

  const age = Date.now() - data.firstAttemptAt;
  if (age > LOGIN_WINDOW_MS) {
    loginAttempts.delete(key);
    return false;
  }

  return data.count >= MAX_LOGIN_ATTEMPTS;
}

function registerFailedLogin(key: string) {
  const current = loginAttempts.get(key);

  if (!current) {
    loginAttempts.set(key, { count: 1, firstAttemptAt: Date.now() });
    return;
  }

  const age = Date.now() - current.firstAttemptAt;
  if (age > LOGIN_WINDOW_MS) {
    loginAttempts.set(key, { count: 1, firstAttemptAt: Date.now() });
    return;
  }

  loginAttempts.set(key, { ...current, count: current.count + 1 });
}

function clearLoginAttempts(key: string) {
  loginAttempts.delete(key);
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  if (!hashed || !salt) return false;

  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;

  if (hashedBuf.length !== suppliedBuf.length) return false;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  const sessionSecret = process.env.SESSION_SECRET || randomBytes(32).toString("hex");

  const sessionSettings: session.SessionOptions = {
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: app.get("env") === "production",
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24,
    },
  };

  if (app.get("env") === "production") {
    app.set("trust proxy", 1);
  }

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(
      { usernameField: "identifier", passwordField: "password" },
      async (identifier, password, done) => {
        try {
          const user = await storage.getUserByLoginIdentifier(identifier);
          if (!user || !(await comparePasswords(password, user.password))) {
            return done(null, false);
          }

          return done(null, user);
        } catch (err) {
          return done(err);
        }
      },
    ),
  );

  passport.serializeUser((user, done) => {
    done(null, (user as User).id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const user = await storage.getUser(Number(id));
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  app.post(api.auth.login.path, (req, res, next) => {
    try {
      const body = api.auth.login.input.parse(req.body);
      const ip = req.ip || "unknown";
      const attemptKey = buildAttemptKey(ip, body.identifier);

      if (isBlockedByRateLimit(attemptKey)) {
        return res.status(429).json({ message: "Muitas tentativas. Aguarde 15 minutos." });
      }

      passport.authenticate("local", (err: unknown, user: User) => {
        if (err) return next(err);

        if (!user) {
          registerFailedLogin(attemptKey);
          return res.status(401).json({ message: "Credenciais invalidas" });
        }

        req.logIn(user, (loginErr) => {
          if (loginErr) return next(loginErr);
          clearLoginAttempts(attemptKey);
          return res.json(sanitizeUser(user));
        });
      })(req, res, next);
    } catch (error) {
      return res.status(400).json({ message: "Dados de login invalidos" });
    }
  });

  app.post(api.auth.logout.path, (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      req.session.destroy(() => {
        res.clearCookie("connect.sid");
        res.sendStatus(200);
      });
    });
  });

  app.get(api.auth.me.path, (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = req.user as User;
    return res.json(sanitizeUser(user));
  });
}
