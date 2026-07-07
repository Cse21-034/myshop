import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, Users, Award, Heart } from "lucide-react";

export default function About() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      {/* Hero Section */}
      <section className="py-8 md:py-16 bg-white">
        <div className="container mx-auto px-[5px] sm:px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-primary mb-4 md:mb-6">About Fountstream</h1>
            <p className="text-base md:text-xl text-gray-600 leading-relaxed px-2">
              Founded in 2025, Fountstream has become a leading destination for fashion-forward individuals 
              seeking quality clothing, footwear, and accessories. Our mission is to make style accessible 
              to everyone while maintaining the highest standards of quality and customer service.
            </p>
          </div>
        </div>
      </section>

      {/* Story Section */}
      <section className="py-8 md:py-16 bg-gray-50">
        <div className="container mx-auto px-[5px] sm:px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 items-center">
            <div className="order-2 lg:order-1">
              <h2 className="text-2xl md:text-3xl font-bold text-primary mb-4 md:mb-6">Our Story</h2>
              <div className="space-y-4 md:space-y-6 text-gray-700">
                <p className="leading-relaxed text-sm md:text-base">
                  We curate our collections from trusted brands and emerging designers, ensuring our customers 
                  have access to the latest trends and timeless classics. Every product in our store is 
                  carefully selected for its quality, style, and value.
                </p>
                <p className="leading-relaxed text-sm md:text-base">
                  What started as a small passion project has grown into a community of style enthusiasts 
                  who believe that great fashion should be accessible to everyone. We're committed to 
                  providing exceptional customer service and building lasting relationships with our customers.
                </p>
                <p className="leading-relaxed text-sm md:text-base">
                  Today, we're proud to serve customers worldwide, offering carefully curated collections 
                  that reflect the latest trends while honoring timeless style principles.
                </p>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <img 
                src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=400" 
                alt="About us - store interior"
                className="rounded-lg shadow-lg w-full h-64 md:h-80 lg:h-96 object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-8 md:py-16 bg-white">
        <div className="container mx-auto px-[5px] sm:px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-primary mb-8 md:mb-12">By the Numbers</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
            <div className="text-center">
              <div className="text-2xl md:text-4xl font-bold text-secondary mb-1 md:mb-2">10K+</div>
              <div className="text-gray-600 text-xs md:text-base">Happy Customers</div>
            </div>
            <div className="text-center">
              <div className="text-2xl md:text-4xl font-bold text-secondary mb-1 md:mb-2">500+</div>
              <div className="text-gray-600 text-xs md:text-base">Products</div>
            </div>
            <div className="text-center">
              <div className="text-2xl md:text-4xl font-bold text-secondary mb-1 md:mb-2">50+</div>
              <div className="text-gray-600 text-xs md:text-base">Brands</div>
            </div>
            <div className="text-center">
              <div className="text-2xl md:text-4xl font-bold text-secondary mb-1 md:mb-2">4.8</div>
              <div className="text-gray-600 text-xs md:text-base">Customer Rating</div>
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-8 md:py-16 bg-gray-50">
        <div className="container mx-auto px-[5px] sm:px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-primary mb-8 md:mb-12">Our Values</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            <Card className="h-full">
              <CardContent className="p-4 md:p-8 text-center">
                <div className="w-12 h-12 md:w-16 md:h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6">
                  <Star className="h-6 w-6 md:h-8 md:w-8 text-white" />
                </div>
                <h3 className="text-lg md:text-xl font-semibold mb-3 md:mb-4">Quality First</h3>
                <p className="text-gray-600 text-sm md:text-base leading-relaxed">
                  We believe in offering only the highest quality products that stand the test of time. 
                  Every item is carefully selected and tested to meet our rigorous standards.
                </p>
              </CardContent>
            </Card>

            <Card className="h-full">
              <CardContent className="p-4 md:p-8 text-center">
                <div className="w-12 h-12 md:w-16 md:h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6">
                  <Users className="h-6 w-6 md:h-8 md:w-8 text-white" />
                </div>
                <h3 className="text-lg md:text-xl font-semibold mb-3 md:mb-4">Customer Focused</h3>
                <p className="text-gray-600 text-sm md:text-base leading-relaxed">
                  Our customers are at the heart of everything we do. We're committed to providing 
                  exceptional service and support throughout your shopping journey.
                </p>
              </CardContent>
            </Card>

            <Card className="h-full">
              <CardContent className="p-4 md:p-8 text-center">
                <div className="w-12 h-12 md:w-16 md:h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6">
                  <Heart className="h-6 w-6 md:h-8 md:w-8 text-white" />
                </div>
                <h3 className="text-lg md:text-xl font-semibold mb-3 md:mb-4">Sustainability</h3>
                <p className="text-gray-600 text-sm md:text-base leading-relaxed">
                  We're committed to sustainable practices and partnering with brands that share 
                  our values of environmental responsibility and ethical manufacturing.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-8 md:py-16 bg-white">
        <div className="container mx-auto px-[5px] sm:px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-primary mb-8 md:mb-12">Meet Our Team</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <img 
                src="https://lh3.googleusercontent.com/a/ACg8ocIL6SRexk21pqmd55opeNjE07AEC4RRaof98Qujvxv4JD-4_ZGVGA=s96-c" 
                alt="Team member"
                className="w-32 h-32 md:w-48 md:h-48 rounded-full mx-auto mb-3 md:mb-4 object-cover"
              />
              <h3 className="text-lg md:text-xl font-semibold mb-1 md:mb-2">Leatile Mosimanyana</h3>
              <p className="text-secondary font-medium mb-2 text-sm md:text-base">Founder & CEO</p>
              <p className="text-gray-600 text-xs md:text-sm leading-relaxed px-2">
                Passionate about fashion and technology, Alex founded Fountstresm with a vision 
                to make quality fashion accessible to everyone.
              </p>
            </div>

            <div className="text-center">
              <img 
                src="https://images.unsplash.com/photo-1494790108755-2616b612b1e8?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=300" 
                alt="Team member"
                className="w-32 h-32 md:w-48 md:h-48 rounded-full mx-auto mb-3 md:mb-4 object-cover"
              />
              <h3 className="text-lg md:text-xl font-semibold mb-1 md:mb-2">Sarah Chen</h3>
              <p className="text-secondary font-medium mb-2 text-sm md:text-base">Head of Design</p>
              <p className="text-gray-600 text-xs md:text-sm leading-relaxed px-2">
                With over 10 years of experience in fashion design, Sarah curates our collections 
                and ensures every product meets our style standards.
              </p>
            </div>

            <div className="text-center">
              <img 
                src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=300" 
                alt="Team member"
                className="w-32 h-32 md:w-48 md:h-48 rounded-full mx-auto mb-3 md:mb-4 object-cover"
              />
              <h3 className="text-lg md:text-xl font-semibold mb-1 md:mb-2">Michael Rodriguez</h3>
              <p className="text-secondary font-medium mb-2 text-sm md:text-base">Customer Experience</p>
              <p className="text-gray-600 text-xs md:text-sm leading-relaxed px-2">
                Michael leads our customer service team, ensuring every customer has an 
                exceptional experience from browsing to delivery.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Mission Statement */}
      <section className="py-8 md:py-16 bg-primary text-white">
        <div className="container mx-auto px-[5px] sm:px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-secondary rounded-full flex items-center justify-center mx-auto mb-6 md:mb-8">
              <Award className="h-8 w-8 md:h-10 md:w-10 text-white" />
            </div>
            <h2 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6">Our Mission</h2>
            <p className="text-base md:text-xl text-gray-200 leading-relaxed mb-6 md:mb-8 px-2">
              To democratize fashion by providing high-quality, stylish clothing and accessories 
              that empower individuals to express their unique style while building a sustainable 
              and inclusive fashion community.
            </p>
            <div className="flex flex-wrap justify-center gap-2 md:gap-4">
              <Badge variant="secondary" className="text-sm md:text-lg px-3 py-1 md:px-4 md:py-2">Quality</Badge>
              <Badge variant="secondary" className="text-sm md:text-lg px-3 py-1 md:px-4 md:py-2">Accessibility</Badge>
              <Badge variant="secondary" className="text-sm md:text-lg px-3 py-1 md:px-4 md:py-2">Sustainability</Badge>
              <Badge variant="secondary" className="text-sm md:text-lg px-3 py-1 md:px-4 md:py-2">Innovation</Badge>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
