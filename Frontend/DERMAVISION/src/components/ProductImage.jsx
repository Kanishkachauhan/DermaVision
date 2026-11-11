import React, { useEffect, useState } from "react";

const PLACEHOLDER_IMAGE = "/product-placeholder.svg";

const ProductImage = ({ imageUrl, name, brand, className = "", loading = "lazy" }) => {
  const [src, setSrc] = useState(imageUrl || PLACEHOLDER_IMAGE);

  useEffect(() => {
    setSrc(imageUrl || PLACEHOLDER_IMAGE);
  }, [imageUrl]);

  const handleError = () => {
    if (src !== PLACEHOLDER_IMAGE) setSrc(PLACEHOLDER_IMAGE);
  };

  return (
    <img
      src={src}
      alt={`${brand ? `${brand} ` : ""}${name || "Skincare"} product`}
      loading={loading}
      onError={handleError}
      className={className}
    />
  );
};

export default ProductImage;
