import {
  pgTable,
  text,
  timestamp,
  integer,
  bigint,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"

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

export const workspaces = pgTable("workspaces", {
  id:                   text("id").primaryKey(),
  name:                 text("name").notNull(),
  slug:                 text("slug").notNull().unique(),
  logoKey:              text("logo_key"),
  accentColor:          text("accent_color"),
  storageProvider:      text("storage_provider", { enum: ["managed"] }).notNull().default("managed"),
  storageUsedBytes:     bigint("storage_used_bytes", { mode: "number" }).notNull().default(0),
  onboardingCompletedAt: timestamp("onboarding_completed_at", { mode: "date" }),
  createdAt:            timestamp("created_at").defaultNow().notNull(),
  updatedAt:            timestamp("updated_at").defaultNow().notNull(),
})

export const workspaceMembers = pgTable("workspace_members", {
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  userId:      text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role:        text("role", { enum: ["owner", "editor", "viewer"] }).notNull().default("owner"),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  primaryKey({ columns: [t.workspaceId, t.userId] }),
  index("workspace_members_user_workspace_idx").on(t.userId, t.workspaceId),
])

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
  id:            text("id").primaryKey(),
  userId:        text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  workspaceId:   text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name:          text("name").notNull(),
  slug:          text("slug").notNull().unique(),
  passwordHash:  text("password_hash"),
  expiresAt:     timestamp("expires_at", { mode: "date" }),
  downloadMode:  text("download_mode", { enum: ["none", "lowres", "full"] }).notNull().default("none"),
  stage:         text("stage", { enum: ["proofing", "delivered", "both"] }).notNull().default("proofing"),
  maxSelections: integer("max_selections"),
  logoKey:       text("logo_key"),
  accentColor:   text("accent_color"),
  createdAt:     timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("galleries_workspace_created_idx").on(t.workspaceId, t.createdAt)])

export const photos = pgTable("photos", {
  id:             text("id").primaryKey(),
  galleryId:      text("gallery_id").notNull().references(() => galleries.id, { onDelete: "cascade" }),
  userId:         text("user_id").notNull().references(() => users.id),
  section:        text("section", { enum: ["proofing", "final"] }).notNull().default("proofing"),
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
  status:         text("status", { enum: ["pending", "processing", "ready", "error", "cleaning"] }).notNull().default("pending"),
  blurHash:       text("blur_hash"),
  editRecipe:     text("edit_recipe"),
  sourcePhotoId:  text("source_photo_id"),
  createdAt:      timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("photos_gallery_status_sort_idx").on(t.galleryId, t.status, t.sortOrder)])

export const stars = pgTable("stars", {
  id:        text("id").primaryKey(),
  photoId:   text("photo_id").notNull().references(() => photos.id, { onDelete: "cascade" }),
  galleryId: text("gallery_id").notNull().references(() => galleries.id, { onDelete: "cascade" }),
  clientId:  text("client_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("stars_photo_client_idx").on(t.photoId, t.clientId),
  index("stars_gallery_client_idx").on(t.galleryId, t.clientId),
])

export const comments = pgTable("comments", {
  id:         text("id").primaryKey(),
  photoId:    text("photo_id").notNull().references(() => photos.id, { onDelete: "cascade" }),
  body:       text("body").notNull(),
  authorName: text("author_name"),
  createdAt:  timestamp("created_at").defaultNow().notNull(),
}, (t) => [index("comments_photo_created_idx").on(t.photoId, t.createdAt)])

export const selections = pgTable("selections", {
  id:          text("id").primaryKey(),
  galleryId:   text("gallery_id").notNull().references(() => galleries.id, { onDelete: "cascade" }),
  clientId:    text("client_id").notNull(),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
}, (t) => [uniqueIndex("selections_gallery_client_idx").on(t.galleryId, t.clientId)])

export const selectionRateLimits = pgTable("selection_rate_limits", {
  galleryId:       text("gallery_id").notNull().references(() => galleries.id, { onDelete: "cascade" }),
  visitorHash:     text("visitor_hash").notNull(),
  windowStartedAt: timestamp("window_started_at", { mode: "date" }).notNull(),
  attempts:        integer("attempts").notNull().default(0),
}, (t) => [primaryKey({ columns: [t.galleryId, t.visitorHash] })])

export const prototypeAnalysisRateLimits = pgTable("prototype_analysis_rate_limits", {
  userId:          text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  windowStartedAt: timestamp("window_started_at", { mode: "date" }).notNull(),
  attempts:        integer("attempts").notNull().default(0),
})

export const selectionPhotos = pgTable("selection_photos", {
  selectionId: text("selection_id").notNull().references(() => selections.id, { onDelete: "cascade" }),
  photoId:     text("photo_id").notNull().references(() => photos.id, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.selectionId, t.photoId] })])

export const galleriesRelations = relations(galleries, ({ many }) => ({
  photos: many(photos),
  selections: many(selections),
}))

export const photosRelations = relations(photos, ({ one }) => ({
  gallery: one(galleries, { fields: [photos.galleryId], references: [galleries.id] }),
}))

export const selectionsRelations = relations(selections, ({ one, many }) => ({
  gallery: one(galleries, { fields: [selections.galleryId], references: [galleries.id] }),
  selectionPhotos: many(selectionPhotos),
}))

export const selectionPhotosRelations = relations(selectionPhotos, ({ one }) => ({
  selection: one(selections, { fields: [selectionPhotos.selectionId], references: [selections.id] }),
  photo: one(photos, { fields: [selectionPhotos.photoId], references: [photos.id] }),
}))

