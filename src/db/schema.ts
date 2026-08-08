import {
  pgTable,
  text,
  timestamp,
  integer,
  bigint,
  uniqueIndex,
} from "drizzle-orm/pg-core"

export const users = pgTable("users", {
  id:               text("id").primaryKey(),
  email:            text("email").notNull().unique(),
  emailVerified:    timestamp("email_verified", { mode: "date" }),
  passwordHash:     text("password_hash"),
  name:             text("name"),
  image:            text("image"),
  logoKey:          text("logo_key"),
  accentColor:      text("accent_color"),
  storageUsedBytes: bigint("storage_used_bytes", { mode: "number" }).notNull().default(0),
  createdAt:        timestamp("created_at").defaultNow().notNull(),
})

export const accounts = pgTable("accounts", {
  userId:            text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type:              text("type").notNull(),
  provider:          text("provider").notNull(),
  providerAccountId: text("provider_account_id").notNull(),
  refresh_token:     text("refresh_token"),
  access_token:      text("access_token"),
  expires_at:        integer("expires_at"),
  token_type:        text("token_type"),
  scope:             text("scope"),
  id_token:          text("id_token"),
  session_state:     text("session_state"),
}, (t) => [uniqueIndex("accounts_provider_idx").on(t.provider, t.providerAccountId)])

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId:       text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expires:      timestamp("expires", { mode: "date" }).notNull(),
})

export const verificationTokens = pgTable("verification_tokens", {
  identifier: text("identifier").notNull(),
  token:      text("token").notNull(),
  expires:    timestamp("expires", { mode: "date" }).notNull(),
})

export const galleries = pgTable("galleries", {
  id:           text("id").primaryKey(),
  userId:       text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name:         text("name").notNull(),
  slug:         text("slug").notNull().unique(),
  passwordHash: text("password_hash"),
  expiresAt:    timestamp("expires_at", { mode: "date" }),
  downloadMode: text("download_mode", { enum: ["none", "lowres", "full"] }).notNull().default("none"),
  logoKey:      text("logo_key"),
  accentColor:  text("accent_color"),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
})

export const photos = pgTable("photos", {
  id:             text("id").primaryKey(),
  galleryId:      text("gallery_id").notNull().references(() => galleries.id, { onDelete: "cascade" }),
  userId:         text("user_id").notNull().references(() => users.id),
  originalKey:    text("original_key").notNull(),
  thumbKey:       text("thumb_key"),
  displayKey:     text("display_key"),
  watermarkedKey: text("watermarked_key"),
  filename:       text("filename").notNull(),
  mimeType:       text("mime_type").notNull(),
  fileSizeBytes:  bigint("file_size_bytes", { mode: "number" }).notNull(),
  width:          integer("width"),
  height:         integer("height"),
  sortOrder:      integer("sort_order").notNull().default(0),
  status:         text("status", { enum: ["pending", "ready", "error"] }).notNull().default("pending"),
  createdAt:      timestamp("created_at").defaultNow().notNull(),
})

export const stars = pgTable("stars", {
  id:        text("id").primaryKey(),
  photoId:   text("photo_id").notNull().references(() => photos.id, { onDelete: "cascade" }),
  galleryId: text("gallery_id").notNull().references(() => galleries.id, { onDelete: "cascade" }),
  clientId:  text("client_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [uniqueIndex("stars_photo_client_idx").on(t.photoId, t.clientId)])

export const comments = pgTable("comments", {
  id:         text("id").primaryKey(),
  photoId:    text("photo_id").notNull().references(() => photos.id, { onDelete: "cascade" }),
  body:       text("body").notNull(),
  authorName: text("author_name"),
  createdAt:  timestamp("created_at").defaultNow().notNull(),
})

export const selections = pgTable("selections", {
  id:          text("id").primaryKey(),
  galleryId:   text("gallery_id").notNull().references(() => galleries.id, { onDelete: "cascade" }),
  photoIds:    text("photo_ids").array().notNull(),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
})
