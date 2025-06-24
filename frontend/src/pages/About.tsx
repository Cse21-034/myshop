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
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-primary mb-6">About sho-Audio</h1>
            <p className="text-xl text-gray-600 leading-relaxed">
              Founded in 2020, sho-Audio has become a leading destination for fashion-forward individuals 
              seeking quality clothing, footwear, and accessories. Our mission is to make style accessible 
              to everyone while maintaining the highest standards of quality and customer service.
            </p>
          </div>
        </div>
      </section>

      {/* Story Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-primary mb-6">Our Story</h2>
              <div className="space-y-6 text-gray-700">
                <p className="leading-relaxed">
                  We curate our collections from trusted brands and emerging designers, ensuring our customers 
                  have access to the latest trends and timeless classics. Every product in our store is 
                  carefully selected for its quality, style, and value.
                </p>
                <p className="leading-relaxed">
                  What started as a small passion project has grown into a community of style enthusiasts 
                  who believe that great fashion should be accessible to everyone. We're committed to 
                  providing exceptional customer service and building lasting relationships with our customers.
                </p>
                <p className="leading-relaxed">
                  Today, we're proud to serve customers worldwide, offering carefully curated collections 
                  that reflect the latest trends while honoring timeless style principles.
                </p>
              </div>
            </div>
            <div>
              <img 
                src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=400" 
                alt="About us - store interior"
                className="rounded-lg shadow-lg w-full h-96 object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-primary mb-12">By the Numbers</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-secondary mb-2">10K+</div>
              <div className="text-gray-600">Happy Customers</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-secondary mb-2">500+</div>
              <div className="text-gray-600">Products</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-secondary mb-2">50+</div>
              <div className="text-gray-600">Brands</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-secondary mb-2">4.8</div>
              <div className="text-gray-600">Customer Rating</div>
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-primary mb-12">Our Values</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card>
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-6">
                  <Star className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-4">Quality First</h3>
                <p className="text-gray-600">
                  We believe in offering only the highest quality products that stand the test of time. 
                  Every item is carefully selected and tested to meet our rigorous standards.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-6">
                  <Users className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-4">Customer Focused</h3>
                <p className="text-gray-600">
                  Our customers are at the heart of everything we do. We're committed to providing 
                  exceptional service and support throughout your shopping journey.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-6">
                  <Heart className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold mb-4">Sustainability</h3>
                <p className="text-gray-600">
                  We're committed to sustainable practices and partnering with brands that share 
                  our values of environmental responsibility and ethical manufacturing.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-primary mb-12">Meet Our Team</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <img 
                src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=300" 
                alt="Team member"
                className="w-48 h-48 rounded-full mx-auto mb-4 object-cover"
              />
              <h3 className="text-xl font-semibold mb-2">Alex Johnson</h3>
              <p className="text-secondary font-medium mb-2">Founder & CEO</p>
              <p className="text-gray-600 text-sm">
                Passionate about fashion and technology, Alex founded sho-Audio with a vision 
                to make quality fashion accessible to everyone.
              </p>
            </div>

            <div className="text-center">
              <img 
                src="https://images.unsplash.com/photo-1494790108755-2616b612b1e8?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=300" 
                alt="Team member"
                className="w-48 h-48 rounded-full mx-auto mb-4 object-cover"
              />
              <h3 className="text-xl font-semibold mb-2">Sarah Chen</h3>
              <p className="text-secondary font-medium mb-2">Head of Design</p>
              <p className="text-gray-600 text-sm">
                With over 10 years of experience in fashion design, Sarah curates our collections 
                and ensures every product meets our style standards.
              </p>
            </div>

            <div className="text-center">
              <img 
                src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&h=300" 
                alt="Team member"
                className="w-48 h-48 rounded-full mx-auto mb-4 object-cover"
              />
              <h3 className="text-xl font-semibold mb-2">Michael Rodriguez</h3>
              <p className="text-secondary font-medium mb-2">Customer Experience</p>
              <p className="text-gray-600 text-sm">
                Michael leads our customer service team, ensuring every customer has an 
                exceptional experience from browsing to delivery.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Mission Statement */}
      <section className="py-16 bg-primary text-white">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mx-auto mb-8">
              <Award className="h-10 w-10 text-white" />
            </div>
            <h2 className="text-3xl font-bold mb-6">Our Mission</h2>
            <p className="text-xl text-gray-200 leading-relaxed mb-8">
              To democratize fashion by providing high-quality, stylish clothing and accessories 
              that empower individuals to express their unique style while building a sustainable 
              and inclusive fashion community.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Badge variant="secondary" className="text-lg px-4 py-2">Quality</Badge>
              <Badge variant="secondary" className="text-lg px-4 py-2">Accessibility</Badge>
              <Badge variant="secondary" className="text-lg px-4 py-2">Sustainability</Badge>
              <Badge variant="secondary" className="text-lg px-4 py-2">Innovation</Badge>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
