import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import icon from "astro-icon";

export default defineConfig({
	output: "static",
	base: "/",
	integrations: [
		icon({
			include: {
				"flat-color-icons": [
					"folder",
					"opened-folder",
					"document",
					"file",
					"video-file",
					"link",
					"multiple-devices",
				],
				"simple-icons": ["github", "linkedin", "gmail", "whatsapp"],
				lucide: ["external-link"],
			},
		}),
	],
	vite: {
		plugins: [tailwindcss()],
	},
});
