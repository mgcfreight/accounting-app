import { ReactNode, useState } from "react";

const slides = [
  "/mokal-carousal-1.jpg",
  "/mokal-carousal-1.jpg",
  "/mokal-carousal-1.jpg",
];

// mokal-app's CarouselLayout + AuthCarousel: the image panel on the left and
// the form on the right.
export function CarouselLayout({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState(0);

  return (
    <div className="h-full grid lg:grid-cols-2 grid-cols-1 gap-5">
      <div className="lg:block hidden overflow-hidden relative h-full rounded-3xl">
        <div
          className="flex transition ease-out duration-500 h-full"
          style={{ transform: `translateX(-${current * 100}%)` }}
        >
          {slides.map((src, i) => (
            <img
              key={`slide-${i}`}
              className="absolute inset-0 w-full h-full object-cover"
              src={src}
              alt=""
            />
          ))}
        </div>
        <div className="absolute bottom-0 left-0 w-full h-2/3 bg-linear-to-t from-base-primary to-transparent" />
        <div className="absolute text-center w-full bottom-30 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <h3 className="text-white text-5xl font-bold uppercase w-full">
            MGC Accounts
          </h3>
          <p className="text-white mt-5 text-2xl w-100 font-medium text-center mx-auto">
            Invoices, payments and statements for MGC Freight
          </p>
        </div>
        <div className="absolute bottom-16 py-4 flex justify-center gap-2 w-full">
          {slides.map((_, i) => (
            <button
              type="button"
              aria-label={`Slide ${i + 1}`}
              onClick={() => setCurrent(i)}
              key={`dot-${i}`}
              className={`rounded-full h-3 ${
                i === current ? "bg-white w-7" : "bg-[#96BFFF] w-3"
              }`}
            />
          ))}
        </div>
      </div>
      <div className="flex justify-between items-center flex-col">
        <div>&nbsp;</div>
        <div className="max-w-sm xl:max-w-md w-full">
          <h1 className="text-3xl font-black mb-2 text-center">MGC FREIGHT</h1>
          <p className="text-center text-xs font-bold tracking-[0.3em] text-base-primary-300 mb-8">
            ACCOUNTS
          </p>
          {children}
        </div>
        <div className="text-center text-xs font-medium">
          <p className="text-content-5">For MGC Freight staff only.</p>
        </div>
      </div>
    </div>
  );
}
