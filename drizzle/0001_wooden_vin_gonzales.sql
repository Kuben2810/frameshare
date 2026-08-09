CREATE TABLE "selection_photos" (
	"selection_id" text NOT NULL,
	"photo_id" text NOT NULL,
	CONSTRAINT "selection_photos_selection_id_photo_id_pk" PRIMARY KEY("selection_id","photo_id")
);
--> statement-breakpoint
ALTER TABLE "selection_photos" ADD CONSTRAINT "selection_photos_selection_id_selections_id_fk" FOREIGN KEY ("selection_id") REFERENCES "public"."selections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "selection_photos" ADD CONSTRAINT "selection_photos_photo_id_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."photos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "selections" DROP COLUMN "photo_ids";