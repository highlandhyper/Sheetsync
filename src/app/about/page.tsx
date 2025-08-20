import Image from 'next/image';

export default function AboutPage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="grid md:grid-cols-2 gap-16 items-center">
        <div className="relative w-full aspect-video rounded-lg overflow-hidden shadow-xl">
          <Image
            src="/assets/img1.jpg"
            alt="Our team"
            data-ai-hint="team business"
            fill
            className="object-cover"
          />
        </div>
        <div className="space-y-6">
          <h1 className="text-5xl font-headline font-bold">About rbcart</h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Welcome to rbcart, your destination for curated goods that blend quality, style, and function. We believe that the items you bring into your life should be more than just objects; they should be extensions of your personality and enhancements to your daily routines.
          </p>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Our journey began with a simple idea: to create a one-stop shop for thoughtfully selected products that we love and use ourselves. From home essentials and modern furniture to cutting-edge electronics and artisanal kitchenware, every item in our collection is chosen with an eye for detail and a commitment to excellence.
          </p>
          <p className="text-lg text-muted-foreground leading-relaxed">
            We are a small, passionate team dedicated to bringing you the best. Thank you for joining us on this journey.
          </p>
        </div>
      </div>
    </div>
  );
}
