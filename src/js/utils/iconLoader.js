// iconLoader.js

const iconModules = import.meta.glob(
    "/src/assets/icon/*.png",
    {
      eager: true,
      import: "default"
    }
  );
  
  export function getIcon(name) {
    const path = `/src/assets/icon/${name}.png`;
    if (!iconModules[path]) {
      console.error(`Icon not found: ${name}`);
      return "";
    }
    return iconModules[path];
  }
  