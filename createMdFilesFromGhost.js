const GhostContentAPI = require("@tryghost/content-api");
const yaml = require("js-yaml");
const fs = require("fs-extra");
const path = require("path");

if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const ghostURL = process.env.GHOST_URL;
const ghostKey = process.env.GHOST_KEY;
const api = new GhostContentAPI({
  url: ghostURL, // replace with your Ghost API URL
  key: ghostKey, // replace with your API key
  version: "v3",
});

const createMdFilesFromGhost = async () => {
  console.time("All posts converted to Markdown in");

  try {
    // fetch the posts from the Ghost Content API
    const posts = await api.posts.browse({
      limit: "all",
      include: "tags,authors",
      formats: ["html"],
      filter: [
        "tag:ambassador-marketing",
        "tag:cpg",
        "tag:influencer-marketing",
        "tag:instagram",
        "tag:micro-influencer-marketing",
        "tag:podcasts",
        "tag:social-media",
        "tag:tiktok",
        "tag:ugc",
      ],
    });

    await Promise.all(
      posts.map(async (post) => {
        let content = post.html;
        content = content.replace(
          /https:\/\/ghost.inbeat.co\/content\/images/gi,
          "https://ghost.inbeat.co/content/images/size/w1000"
        );
        // content = content.replace(/<p>{{% protip title=&quot;/gi, '{{% protip title="');
        // content = content.replace(/&quot; %}}<\/p>/gi, '" %}}');
        // content = content.replace('<p>{{% /protip %}}</p>', '{{% /protip %}}');

        const frontmatter = {
          title: post.meta_title || post.title,
          description: post.meta_description || post.excerpt,
          titre: post.title,
          slug: post.slug,
          feature_image: post.feature_image,
          og_image: post.og_image || post.feature_image,
          lastmod: post.updated_at,
          date: post.published_at,
          summary: post.excerpt,
          i18nlanguage: "en",
          weight: post.featured ? 1 : 0,
          draft: post.visibility !== "public",
        };

        if (post.og_title) {
          frontmatter.og_title = post.og_title;
        }

        if (post.og_description) {
          frontmatter.og_description = post.og_description;
        }

        // The format of og_image is /content/images/2020/04/easily-scale-your-influencer-marketing-campaigns-social.png
        // without the root of the URL. Prepend if necessary.
        let ogImage = post.og_image || post.feature_image;
        if (!ogImage.includes("https://ghost.inbeat.co")) {
          ogImage = "https://ghost.inbeat.co" + ogImage;
        }
        frontmatter.og_image = ogImage;

        // There should be at least tag on the post.
        if (!post.tags || !post.tags.length) {
          return;
        }

        // There should be at least one author.
        if (!post.authors || !post.authors.length) {
          return;
        }

        // We only use the first tag.
        frontmatter.categories = [post.tags[0].name];

        if (post.tags[0].name == "Wikis" || post.tags[0].name == "Podcasts") {
          frontmatter.unlisted = true;
        }

        if (post.tags[0].name == "Podcasts") {
          frontmatter.unlisted = true;
          sections = content.split("<!--kg-card-end: markdown-->");
          // The markdown section should be there and at the beginning.
          if (sections.length < 2) {
            return;
          }

          // The content is after the markdown
          content = sections[1];

          // Get extrainfos from the Markdown block
          const jsonString = sections[0]
            .split("<p>")[1]
            .replace("</p>", "")
            .replace(/&quot;/g, '"');
          const extraInfos = JSON.parse(jsonString);
          frontmatter.listentime = extraInfos.time;
          post.authors[0] = {
            name: extraInfos.invitee,
            profile_image: "https://ghost.inbeat.co" + extraInfos.avatar,
          };
        }

        // Rewrite the avatar url for a small one.
        frontmatter.authors = post.authors.map((author) => ({
          ...author,
          profile_image: author.profile_image.replace(
            "content/images/",
            "content/images/size/w100/"
          ),
        }));

        // If there's a canonical url, please add it.
        if (post.canonical_url) {
          frontmatter.canonical = post.canonical_url;
        }

        // Create frontmatter properties from all keys in our post object
        const yamlPost = await yaml.dump(frontmatter);

        // Super simple concatenating of the frontmatter and our content
        const fileString = `---\n${yamlPost}\n---\n${content}\n`;

        // Save the final string of our file as a Markdown file
        await fs.writeFile(
          path.join("content/articles", `${post.slug}.md`),
          fileString,
          { flag: "w" }
        );
      })
    );

    console.timeEnd("All posts converted to Markdown in");
  } catch (error) {
    console.error(error);
  }
};

module.exports = createMdFilesFromGhost();
