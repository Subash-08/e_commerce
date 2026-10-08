import type {
  ProductInput,
  VariantInput,
} from "../../src/modules/catalog/validation.ts";
import { productInput } from "../../src/modules/catalog/validation.ts";

export const DEMO_SEED_MARKER = "demo-catalog-v1";
export const DEMO_SEED_ACTOR = "operator:demo-catalog-seed";

export const demoIds = {
  brands: {
    northstar: "670000000000000000000001",
    pixelworks: "670000000000000000000002",
  },
  categories: {
    computers: "671000000000000000000001",
    laptops: "671000000000000000000002",
    desktops: "671000000000000000000003",
    accessories: "671000000000000000000004",
    monitors: "671000000000000000000005",
  },
  attributes: {
    memory: "672000000000000000000001",
    storage: "672000000000000000000002",
    colour: "672000000000000000000003",
    screenSize: "672000000000000000000004",
  },
  options: {
    memory8: "673000000000000000000001",
    memory16: "673000000000000000000002",
    memory32: "673000000000000000000003",
    storage256: "673000000000000000000004",
    storage512: "673000000000000000000005",
    storage1tb: "673000000000000000000006",
    black: "673000000000000000000007",
    silver: "673000000000000000000008",
    screen24: "673000000000000000000009",
    screen27: "67300000000000000000000a",
  },
  products: {
    notebook: "674000000000000000000001",
    gamingLaptop: "674000000000000000000002",
    miniPc: "674000000000000000000003",
    monitor: "674000000000000000000004",
    keyboard: "674000000000000000000005",
  },
  variants: {
    notebook8: "675000000000000000000001",
    notebook16: "675000000000000000000002",
    gaming16: "675000000000000000000003",
    gaming32: "675000000000000000000004",
    mini256: "675000000000000000000005",
    mini512: "675000000000000000000006",
    monitor24: "675000000000000000000007",
    monitor27: "675000000000000000000008",
    keyboardBlack: "675000000000000000000009",
    keyboardSilver: "67500000000000000000000a",
  },
} as const;

export const demoBrands = [
  {
    id: demoIds.brands.northstar,
    name: "Demo Northstar",
    slug: "demo-northstar",
    description:
      "Portable computers and compact workstations for the demo catalog.",
    featured: true,
    displayOrder: 10,
  },
  {
    id: demoIds.brands.pixelworks,
    name: "Demo Pixelworks",
    slug: "demo-pixelworks",
    description:
      "Displays and desk accessories used to exercise catalog presentation.",
    featured: true,
    displayOrder: 20,
  },
] as const;

export const demoCategories = [
  {
    id: demoIds.categories.computers,
    name: "Demo Computers",
    slug: "demo-computers",
    parentId: null,
    description: "Demo laptops and desktop computers.",
    featured: true,
    displayOrder: 10,
  },
  {
    id: demoIds.categories.laptops,
    name: "Demo Laptops",
    slug: "demo-laptops",
    parentId: demoIds.categories.computers,
    description: "Portable computers for work, study and gaming.",
    featured: true,
    displayOrder: 11,
  },
  {
    id: demoIds.categories.desktops,
    name: "Demo Desktops",
    slug: "demo-desktops",
    parentId: demoIds.categories.computers,
    description: "Compact desktop systems for everyday work.",
    featured: false,
    displayOrder: 12,
  },
  {
    id: demoIds.categories.accessories,
    name: "Demo Accessories",
    slug: "demo-accessories",
    parentId: null,
    description: "Keyboards, displays and desk accessories.",
    featured: true,
    displayOrder: 20,
  },
  {
    id: demoIds.categories.monitors,
    name: "Demo Monitors",
    slug: "demo-monitors",
    parentId: demoIds.categories.accessories,
    description: "Productivity and entertainment displays.",
    featured: false,
    displayOrder: 21,
  },
] as const;

export const demoAttributes = [
  {
    id: demoIds.attributes.memory,
    code: "demo_memory",
    name: "Memory",
    type: "SINGLE_SELECT" as const,
    unit: "GB",
    visible: true,
    filterable: true,
    variantAxisAllowed: true,
    displayOrder: 10,
    options: [
      {
        id: demoIds.options.memory8,
        label: "8 GB",
        colour: "",
        active: true,
      },
      {
        id: demoIds.options.memory16,
        label: "16 GB",
        colour: "",
        active: true,
      },
      {
        id: demoIds.options.memory32,
        label: "32 GB",
        colour: "",
        active: true,
      },
    ],
  },
  {
    id: demoIds.attributes.storage,
    code: "demo_storage",
    name: "Storage",
    type: "SINGLE_SELECT" as const,
    unit: "",
    visible: true,
    filterable: true,
    variantAxisAllowed: true,
    displayOrder: 20,
    options: [
      {
        id: demoIds.options.storage256,
        label: "256 GB SSD",
        colour: "",
        active: true,
      },
      {
        id: demoIds.options.storage512,
        label: "512 GB SSD",
        colour: "",
        active: true,
      },
      {
        id: demoIds.options.storage1tb,
        label: "1 TB SSD",
        colour: "",
        active: true,
      },
    ],
  },
  {
    id: demoIds.attributes.colour,
    code: "demo_colour",
    name: "Colour",
    type: "COLOUR" as const,
    unit: "",
    visible: true,
    filterable: true,
    variantAxisAllowed: true,
    displayOrder: 30,
    options: [
      {
        id: demoIds.options.black,
        label: "Midnight black",
        colour: "#18181b",
        active: true,
      },
      {
        id: demoIds.options.silver,
        label: "Silver",
        colour: "#d4d4d8",
        active: true,
      },
    ],
  },
  {
    id: demoIds.attributes.screenSize,
    code: "demo_screen_size",
    name: "Screen size",
    type: "SINGLE_SELECT" as const,
    unit: "in",
    visible: true,
    filterable: true,
    variantAxisAllowed: true,
    displayOrder: 40,
    options: [
      {
        id: demoIds.options.screen24,
        label: "24 inch",
        colour: "",
        active: true,
      },
      {
        id: demoIds.options.screen27,
        label: "27 inch",
        colour: "",
        active: true,
      },
    ],
  },
] as const;

const image = (url: string, alt: string) => ({ url, alt });
const laptopImage = image(
  "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=1200&q=80",
  "Open laptop on a desk",
);
const gamingImage = image(
  "https://images.unsplash.com/photo-1603302576837-37561b2e2302?auto=format&fit=crop&w=1200&q=80",
  "Gaming laptop with illuminated keyboard",
);
const desktopImage = image(
  "https://images.unsplash.com/photo-1593640495253-23196b27a87f?auto=format&fit=crop&w=1200&q=80",
  "Compact desktop workspace",
);
const monitorImage = image(
  "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=1200&q=80",
  "Desktop monitor on a workspace",
);
const keyboardImage = image(
  "https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=1200&q=80",
  "Mechanical keyboard",
);

function variant(
  id: string,
  sku: string,
  title: string,
  mrpPaise: number,
  salePaise: number,
  options: VariantInput["options"],
  onHand: number | null,
): VariantInput {
  return {
    id,
    sku,
    barcode: "",
    title,
    options,
    active: true,
    archived: false,
    mrpPaise,
    salePaise,
    costPaise: null,
    priceMode: "INCLUSIVE",
    gstRateBps: 1800,
    trackQuantity: onHand !== null,
    stockStatus: onHand === null || onHand > 0 ? "IN_STOCK" : "OUT_OF_STOCK",
    onHand,
    media: [],
    weightGrams: null,
    lengthMm: null,
    widthMm: null,
    heightMm: null,
    specifications: [],
  };
}

type ProductFields = Omit<
  ProductInput,
  "revision" | "status" | "seo" | "notes" | "manufacturerContent" | "videos"
> &
  Partial<Pick<ProductInput, "seo" | "manufacturerContent" | "videos">>;

function product(value: ProductFields): ProductInput {
  return productInput.parse({
    ...value,
    status: "ACTIVE",
    notes: "Seeded demo record. Rerunning the seed resets demo fields.",
    manufacturerContent: value.manufacturerContent ?? [],
    videos: value.videos ?? [],
    seo: value.seo ?? {
      title: "",
      description: value.summary.slice(0, 170),
      robotsIndex: false,
    },
  });
}

export const demoProducts: ReadonlyArray<{
  id: string;
  input: ProductInput;
}> = [
  {
    id: demoIds.products.notebook,
    input: product({
      name: "Demo Northstar Air 14",
      slug: "demo-northstar-air-14",
      brandId: demoIds.brands.northstar,
      categoryIds: [demoIds.categories.computers, demoIds.categories.laptops],
      primaryCategoryId: demoIds.categories.laptops,
      summary:
        "A lightweight 14-inch notebook with configurable memory and storage.",
      description:
        "A balanced demonstration notebook for testing variant selection, pricing, stock and responsive product media.",
      modelNumber: "DEMO-NSA14",
      hsn: "84713010",
      tags: ["demo", "laptop", "portable"],
      warranty: "1 year demonstration warranty",
      thumbnail: laptopImage,
      hoverImage: gamingImage,
      media: [laptopImage],
      attributes: [],
      specifications: [
        {
          heading: "Display",
          entries: [
            { label: "Panel", value: "14-inch IPS" },
            { label: "Resolution", value: "1920 × 1200" },
          ],
        },
      ],
      features: [
        {
          title: "Portable",
          description: "Lightweight format for mobile work.",
        },
        {
          title: "Upgradeable",
          description: "Multiple memory and storage configurations.",
        },
      ],
      linkedProductIds: [demoIds.products.monitor, demoIds.products.keyboard],
      defaultVariantId: demoIds.variants.notebook8,
      variants: [
        variant(
          demoIds.variants.notebook8,
          "DEMO-NSA14-8-256",
          "8 GB / 256 GB",
          6_499_900,
          5_799_900,
          [
            {
              attributeId: demoIds.attributes.memory,
              optionId: demoIds.options.memory8,
            },
            {
              attributeId: demoIds.attributes.storage,
              optionId: demoIds.options.storage256,
            },
          ],
          8,
        ),
        variant(
          demoIds.variants.notebook16,
          "DEMO-NSA14-16-512",
          "16 GB / 512 GB",
          7_499_900,
          6_799_900,
          [
            {
              attributeId: demoIds.attributes.memory,
              optionId: demoIds.options.memory16,
            },
            {
              attributeId: demoIds.attributes.storage,
              optionId: demoIds.options.storage512,
            },
          ],
          4,
        ),
      ],
    }),
  },
  {
    id: demoIds.products.gamingLaptop,
    input: product({
      name: "Demo Northstar Forge 16",
      slug: "demo-northstar-forge-16",
      brandId: demoIds.brands.northstar,
      categoryIds: [demoIds.categories.computers, demoIds.categories.laptops],
      primaryCategoryId: demoIds.categories.laptops,
      summary:
        "A gaming notebook with high-refresh display and two memory options.",
      description:
        "A demonstration gaming system used to inspect high-value pricing, variant availability and product-page media.",
      modelNumber: "DEMO-NSF16",
      hsn: "84713010",
      tags: ["demo", "gaming", "laptop"],
      warranty: "1 year demonstration warranty",
      thumbnail: gamingImage,
      hoverImage: null,
      media: [gamingImage],
      attributes: [],
      specifications: [
        {
          heading: "Graphics",
          entries: [{ label: "GPU", value: "Demo discrete graphics" }],
        },
      ],
      features: [
        {
          title: "High refresh display",
          description: "Designed to demonstrate gaming-product merchandising.",
        },
      ],
      linkedProductIds: [demoIds.products.monitor, demoIds.products.keyboard],
      defaultVariantId: demoIds.variants.gaming16,
      variants: [
        variant(
          demoIds.variants.gaming16,
          "DEMO-NSF16-16",
          "16 GB / 512 GB",
          12_499_900,
          11_499_900,
          [
            {
              attributeId: demoIds.attributes.memory,
              optionId: demoIds.options.memory16,
            },
            {
              attributeId: demoIds.attributes.storage,
              optionId: demoIds.options.storage512,
            },
          ],
          3,
        ),
        variant(
          demoIds.variants.gaming32,
          "DEMO-NSF16-32",
          "32 GB / 1 TB",
          14_999_900,
          13_799_900,
          [
            {
              attributeId: demoIds.attributes.memory,
              optionId: demoIds.options.memory32,
            },
            {
              attributeId: demoIds.attributes.storage,
              optionId: demoIds.options.storage1tb,
            },
          ],
          0,
        ),
      ],
    }),
  },
  {
    id: demoIds.products.miniPc,
    input: product({
      name: "Demo Northstar Core Mini",
      slug: "demo-northstar-core-mini",
      brandId: demoIds.brands.northstar,
      categoryIds: [demoIds.categories.computers, demoIds.categories.desktops],
      primaryCategoryId: demoIds.categories.desktops,
      summary: "A compact desktop offered with two SSD capacities.",
      description:
        "A small demonstration desktop for validating category browsing, variant filters and related accessories.",
      modelNumber: "DEMO-NSCM",
      hsn: "84715000",
      tags: ["demo", "desktop", "compact"],
      warranty: "1 year demonstration warranty",
      thumbnail: desktopImage,
      hoverImage: null,
      media: [desktopImage],
      attributes: [],
      specifications: [
        {
          heading: "Connectivity",
          entries: [{ label: "Network", value: "Wi-Fi and Ethernet" }],
        },
      ],
      features: [
        {
          title: "Compact footprint",
          description: "Fits small offices and home desks.",
        },
      ],
      linkedProductIds: [demoIds.products.monitor, demoIds.products.keyboard],
      defaultVariantId: demoIds.variants.mini256,
      variants: [
        variant(
          demoIds.variants.mini256,
          "DEMO-NSCM-256",
          "256 GB SSD",
          4_299_900,
          3_899_900,
          [
            {
              attributeId: demoIds.attributes.storage,
              optionId: demoIds.options.storage256,
            },
          ],
          6,
        ),
        variant(
          demoIds.variants.mini512,
          "DEMO-NSCM-512",
          "512 GB SSD",
          4_799_900,
          4_399_900,
          [
            {
              attributeId: demoIds.attributes.storage,
              optionId: demoIds.options.storage512,
            },
          ],
          5,
        ),
      ],
    }),
  },
  {
    id: demoIds.products.monitor,
    input: product({
      name: "Demo Pixelworks ViewMax",
      slug: "demo-pixelworks-viewmax",
      brandId: demoIds.brands.pixelworks,
      categoryIds: [
        demoIds.categories.accessories,
        demoIds.categories.monitors,
      ],
      primaryCategoryId: demoIds.categories.monitors,
      summary: "A productivity monitor available in 24-inch and 27-inch sizes.",
      description:
        "A demonstration display with size variants for testing catalog filtering and price ranges.",
      modelNumber: "DEMO-PWVM",
      hsn: "85285200",
      tags: ["demo", "monitor", "display"],
      warranty: "3 year demonstration warranty",
      thumbnail: monitorImage,
      hoverImage: null,
      media: [monitorImage],
      attributes: [],
      specifications: [
        {
          heading: "Panel",
          entries: [
            { label: "Technology", value: "IPS" },
            { label: "Refresh rate", value: "100 Hz" },
          ],
        },
      ],
      features: [
        {
          title: "Flexible sizing",
          description: "Choose the size that fits the workspace.",
        },
      ],
      linkedProductIds: [demoIds.products.miniPc],
      defaultVariantId: demoIds.variants.monitor24,
      variants: [
        variant(
          demoIds.variants.monitor24,
          "DEMO-PWVM-24",
          "24 inch",
          1_499_900,
          1_299_900,
          [
            {
              attributeId: demoIds.attributes.screenSize,
              optionId: demoIds.options.screen24,
            },
          ],
          null,
        ),
        variant(
          demoIds.variants.monitor27,
          "DEMO-PWVM-27",
          "27 inch",
          1_999_900,
          1_749_900,
          [
            {
              attributeId: demoIds.attributes.screenSize,
              optionId: demoIds.options.screen27,
            },
          ],
          null,
        ),
      ],
    }),
  },
  {
    id: demoIds.products.keyboard,
    input: product({
      name: "Demo Pixelworks SwiftKey",
      slug: "demo-pixelworks-swiftkey",
      brandId: demoIds.brands.pixelworks,
      categoryIds: [demoIds.categories.accessories],
      primaryCategoryId: demoIds.categories.accessories,
      summary: "A compact mechanical keyboard in two colours.",
      description:
        "A demonstration accessory for validating colour swatches, status-only availability and related-product cards.",
      modelNumber: "DEMO-PWSK",
      hsn: "84716040",
      tags: ["demo", "keyboard", "mechanical"],
      warranty: "1 year demonstration warranty",
      thumbnail: keyboardImage,
      hoverImage: null,
      media: [keyboardImage],
      attributes: [],
      specifications: [
        {
          heading: "Keyboard",
          entries: [
            { label: "Layout", value: "Compact" },
            { label: "Connection", value: "USB" },
          ],
        },
      ],
      features: [
        {
          title: "Two finishes",
          description: "Colour variants exercise storefront swatches.",
        },
      ],
      linkedProductIds: [demoIds.products.notebook, demoIds.products.miniPc],
      defaultVariantId: demoIds.variants.keyboardBlack,
      variants: [
        variant(
          demoIds.variants.keyboardBlack,
          "DEMO-PWSK-BLK",
          "Midnight black",
          699_900,
          599_900,
          [
            {
              attributeId: demoIds.attributes.colour,
              optionId: demoIds.options.black,
            },
          ],
          null,
        ),
        variant(
          demoIds.variants.keyboardSilver,
          "DEMO-PWSK-SLV",
          "Silver",
          699_900,
          599_900,
          [
            {
              attributeId: demoIds.attributes.colour,
              optionId: demoIds.options.silver,
            },
          ],
          null,
        ),
      ],
    }),
  },
];
