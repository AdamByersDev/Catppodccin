export type ColorScheme = {
  name: string;
  color: string;
};

export type Flavor = {
  name: string;
  colorSchemes: ColorScheme[];
  text: string;
  subtext1: string;
  subtext0: string;
  overlay2: string;
  overlay1: string;
  overlay0: string;
  surface2: string;
  surface1: string;
  surface0: string;
  base: string;
  mantle: string;
  crust: string;
};

/*
  0 - Latte
  1 - Frappé
  2 - Macchiato
  3 - Mocha
*/
export const flavors: Flavor[] = [
  {
    name: "Latte",
    colorSchemes: [
      { name: "rosewater", color: "dc8a78" },
      { name: "flamingo", color: "dd7878" },
      { name: "pink", color: "ea76cb" },
      { name: "mauve", color: "8839ef" },
      { name: "red", color: "d20f39" },
      { name: "maroon", color: "e64553" },
      { name: "peach", color: "fe640b" },
      { name: "yellow", color: "df8e1d" },
      { name: "green", color: "40a02b" },
      { name: "teal", color: "179299" },
      { name: "sky", color: "04a5e5" },
      { name: "sapphire", color: "209fb5" },
      { name: "blue", color: "1e66f5" },
      { name: "lavender", color: "7287fd" },
    ],
    text: "4c4f69",
    subtext1: "5c5f77",
    subtext0: "6c6f85",
    overlay2: "7c7f93",
    overlay1: "8c8fa1",
    overlay0: "9ca0b0",
    surface2: "acb0be",
    surface1: "bcc0cc",
    surface0: "ccd0da",
    base: "eff1f5",
    mantle: "e6e9ef",
    crust: "dce0e8",
  },
  {
    name: "Frappé",
    colorSchemes: [
      { name: "rosewater", color: "f2d5cf" },
      { name: "flamingo", color: "eebebe" },
      { name: "pink", color: "f4b8e4" },
      { name: "mauve", color: "ca9ee6" },
      { name: "red", color: "e78284" },
      { name: "maroon", color: "ea999c" },
      { name: "peach", color: "ef9f76" },
      { name: "yellow", color: "e5c890" },
      { name: "green", color: "a6d189" },
      { name: "teal", color: "81c8be" },
      { name: "sky", color: "99d1db" },
      { name: "sapphire", color: "85c1dc" },
      { name: "blue", color: "8caaee" },
      { name: "lavender", color: "babbf1" },
    ],
    text: "c6d0f5",
    subtext1: "b5bfe2",
    subtext0: "a5adce",
    overlay2: "949cbb",
    overlay1: "838ba7",
    overlay0: "737994",
    surface2: "626880",
    surface1: "51576d",
    surface0: "414559",
    base: "303446",
    mantle: "292c3c",
    crust: "232634",
  },
  {
    name: "Macchiato",
    colorSchemes: [
      { name: "rosewater", color: "f4dbd6" },
      { name: "flamingo", color: "f0c6c6" },
      { name: "pink", color: "f5bde6" },
      { name: "mauve", color: "c6a0f6" },
      { name: "red", color: "ed8796" },
      { name: "maroon", color: "ee99a0" },
      { name: "peach", color: "f5a97f" },
      { name: "yellow", color: "eed49f" },
      { name: "green", color: "a6da95" },
      { name: "teal", color: "8bd5ca" },
      { name: "sky", color: "91d7e3" },
      { name: "sapphire", color: "7dc4e4" },
      { name: "blue", color: "8aadf4" },
      { name: "lavender", color: "b7bdf8" },
    ],
    text: "cad3f5",
    subtext1: "b8c0e0",
    subtext0: "a5adcb",
    overlay2: "939ab7",
    overlay1: "8087a2",
    overlay0: "6e738d",
    surface2: "5b6078",
    surface1: "494d64",
    surface0: "363a4f",
    base: "24273a",
    mantle: "1e2030",
    crust: "181926",
  },
  {
    name: "Mocha",
    colorSchemes: [
      { name: "rosewater", color: "f5e0dc" },
      { name: "flamingo", color: "f2cdcd" },
      { name: "pink", color: "f5c2e7" },
      { name: "mauve", color: "cba6f7" },
      { name: "red", color: "f38ba8" },
      { name: "maroon", color: "eba0ac" },
      { name: "peach", color: "fab387" },
      { name: "yellow", color: "f9e2af" },
      { name: "green", color: "a6e3a1" },
      { name: "teal", color: "94e2d5" },
      { name: "sky", color: "89dceb" },
      { name: "sapphire", color: "74c7ec" },
      { name: "blue", color: "89b4fa" },
      { name: "lavender", color: "b4befe" },
    ],
    text: "cdd6f4",
    subtext1: "bac2de",
    subtext0: "a6adc8",
    overlay2: "9399b2",
    overlay1: "7f849c",
    overlay0: "6c7086",
    surface2: "585b70",
    surface1: "45475a",
    surface0: "313244",
    base: "1e1e2e",
    mantle: "181825",
    crust: "11111b",
  },
];
