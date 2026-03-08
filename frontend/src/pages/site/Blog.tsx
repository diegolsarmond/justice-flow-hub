import { useMemo, useState } from "react";
import { ArrowRight, Calendar, Clock, Filter, Search, Sparkles, Tag, User } from "lucide-react";
import { useNavigate } from "react-router-dom";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TypebotBubble from "@/components/site/TypebotBubble";
import SimpleBackground from "@/components/ui/SimpleBackground";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useBlogPosts, type BlogPost } from "@/hooks/useBlogPosts";
import { cn } from "@/lib/utils";
import { routes } from "@/config/routes";
import { trackEvent } from "@/lib/analytics";
import { formatPostDateTime } from "@/lib/date";

const BlogPage = () => {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<string>("Todos");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const { data: blogPosts = [], isLoading, isError } = useBlogPosts();

  const categories = useMemo(() => {
    return ["Todos", ...new Set(blogPosts.map((post) => post.category))];
  }, [blogPosts]);

  const filteredPosts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return blogPosts.filter((post) => {
      const matchesCategory = activeCategory === "Todos" || post.category === activeCategory;
      if (!matchesCategory) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return (
        post.title.toLowerCase().includes(normalizedSearch) ||
        post.description.toLowerCase().includes(normalizedSearch) ||
        post.tags.some((tag) => tag.toLowerCase().includes(normalizedSearch))
      );
    });
  }, [activeCategory, blogPosts, searchTerm]);

  const featuredPost = useMemo(() => {
    if (filteredPosts.length === 0) {
      return undefined;
    }

    return filteredPosts.find((post) => post.featured) ?? filteredPosts[0];
  }, [filteredPosts]);

  const remainingPosts = useMemo(() => {
    if (!featuredPost) {
      return [];
    }

    return filteredPosts.filter((post) => post.slug !== featuredPost.slug);
  }, [filteredPosts, featuredPost]);

  const trendingPosts = useMemo(() => {
    return blogPosts.filter((post) => post.slug !== featuredPost?.slug).slice(0, 3);
  }, [blogPosts, featuredPost]);

  const topTags = useMemo(() => {
    const counts = new Map<string, number>();

    blogPosts.forEach((post) => {
      post.tags.forEach((tag) => {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      });
    });

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([tag]) => tag);
  }, [blogPosts]);

  const handleNavigateToPost = (post: BlogPost) => {
    trackEvent("blog_post_click", {
      post_title: post.title,
      post_category: post.category,
    });
    navigate(routes.blogPost(post.slug));
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <TypebotBubble />
      <Header />
      <main className="flex-1">
        <section className="relative overflow-hidden bg-primary pt-32 pb-24 lg:pt-40 lg:pb-32">
          {/* Abstract Shapes */}
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-400 rounded-full blur-[120px] opacity-20 animate-pulse"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-400 rounded-full blur-[120px] opacity-20 animate-pulse delay-1000"></div>
          </div>

          <div className="container relative z-10 px-4">
            <div className="max-w-4xl mx-auto flex flex-col items-center text-center gap-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-medium text-white backdrop-blur-md shadow-lg">
                <Sparkles className="h-4 w-4 text-cyan-200" />
                <span className="tracking-wide">Blog Quantum Tecnologia</span>
              </div>

              <h1 className="text-4xl md:text-6xl font-bold leading-tight tracking-tight text-white">
                Insights que conectam tecnologia, estratégia e resultados jurídicos
              </h1>

              <p className="text-lg md:text-xl text-blue-100/90 max-w-2xl leading-relaxed">
                Explore análises profundas, guias práticos e tendências sobre inteligência artificial, automação e transformação
                digital para escritórios e departamentos jurídicos que querem liderar o futuro.
              </p>

              <div className="w-full max-w-2xl mt-8">
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  </div>
                  <Input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Busque por IA, automação, CRM..."
                    className="pl-12 h-14 w-full rounded-2xl border-0 bg-white shadow-xl text-lg placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-primary/20"
                  />
                  <div className="absolute inset-y-0 right-2 flex items-center">
                    <Button
                      size="sm"
                      className="rounded-xl h-10 px-6 bg-primary text-white hover:bg-primary/90 font-medium"
                      onClick={() => navigate({ pathname: routes.home, hash: "#contato" })}
                    >
                      Contato <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-center gap-4 w-full">
                <div className="flex items-center gap-2 text-sm font-medium text-blue-100/70">
                  <Filter className="h-4 w-4" />
                  Filtre por temas em destaque
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {categories.map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setActiveCategory(category)}
                      className={cn(
                        "px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 border",
                        activeCategory === category
                          ? "bg-white text-primary border-white shadow-lg shadow-white/10 scale-105"
                          : "bg-white/5 text-white border-white/10 hover:bg-white/10 hover:border-white/20"
                      )}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="container px-4 py-16 space-y-16">
          {isLoading ? (
            <div className="grid gap-10 lg:grid-cols-[2fr,1fr]">
              <Card className="relative overflow-hidden rounded-3xl border-0 bg-background/80">
                <Skeleton className="h-72 w-full" />
                <CardHeader className="space-y-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                </CardHeader>
              </Card>
              <aside className="space-y-6">
                <Card className="rounded-3xl">
                  <CardHeader>
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {Array.from({ length: 3 }).map((_, index) => (
                      <Skeleton key={index} className="h-12 w-full" />
                    ))}
                  </CardContent>
                </Card>
                <Card className="rounded-3xl">
                  <CardHeader>
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-40" />
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-3">
                    {Array.from({ length: 6 }).map((_, index) => (
                      <Skeleton key={index} className="h-7 w-16 rounded-full" />
                    ))}
                  </CardContent>
                </Card>
              </aside>
            </div>
          ) : isError ? (
            <Card className="rounded-3xl border-destructive/40 bg-destructive/10">
              <CardHeader className="space-y-4 text-destructive">
                <CardTitle className="text-2xl">Não foi possível carregar os artigos</CardTitle>
                <CardDescription>
                  Houve um erro ao buscar o conteúdo do blog. Atualize a página ou tente novamente mais tarde.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : featuredPost ? (
            <div className="grid gap-10 lg:grid-cols-[2fr,1fr]">
              <Card
                id={featuredPost.slug}
                className="group relative overflow-hidden rounded-3xl border-0 shadow-2xl hover:shadow-3xl transition-shadow duration-500"
              >
                <div className="absolute inset-0 overflow-hidden bg-gray-900">
                  {featuredPost.image ? (
                    <img
                      src={featuredPost.image}
                      alt={featuredPost.title}
                      className="h-full w-full object-cover opacity-80 transition-transform duration-700 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-primary/80 to-blue-900" aria-hidden />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
                </div>
                <div className="relative z-10 p-8 md:p-12 flex flex-col justify-end min-h-[500px] gap-6 text-white">
                  <div className="flex flex-wrap items-center gap-3 text-sm text-white/90 font-medium">
                    <span className="inline-flex items-center rounded-full bg-primary px-3 py-1 text-xs font-bold text-white shadow-sm ring-1 ring-inset ring-white/20 backdrop-blur-md">
                      <Sparkles className="mr-1.5 h-3 w-3" /> Destaque
                    </span>
                    <div className="flex items-center gap-1.5 bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm border border-white/10">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatPostDateTime(featuredPost.date)}
                    </div>
                    <div className="flex items-center gap-1.5 bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm border border-white/10">
                      <Clock className="h-3.5 w-3.5" />
                      {featuredPost.readTime}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h2 className="text-3xl md:text-5xl font-bold leading-tight tracking-tight text-white drop-shadow-sm group-hover:text-cyan-100 transition-colors">
                      {featuredPost.title}
                    </h2>
                    <p className="max-w-3xl text-lg text-white/90 line-clamp-3 leading-relaxed drop-shadow-sm">
                      {featuredPost.description}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {featuredPost.tags.map((tag) => (
                      <span key={tag} className="text-xs font-medium px-2.5 py-1 rounded-md bg-white/10 text-white border border-white/20 backdrop-blur-sm">
                        #{tag}
                      </span>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-4 pt-4">
                    <Button
                      size="lg"
                      onClick={() => handleNavigateToPost(featuredPost)}
                      className="bg-white text-primary hover:bg-white/90 font-bold h-12 px-8 rounded-full shadow-lg"
                    >
                      Ler artigo completo
                      <ArrowRight className="h-5 w-5 ml-2" />
                    </Button>
                  </div>
                </div>
              </Card>

              <aside className="space-y-8">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-primary font-bold text-lg mb-2">
                    <Sparkles className="h-5 w-5 text-cyan-500" />
                    <h3>Tendências da semana</h3>
                  </div>
                  <div className="space-y-3">
                    {trendingPosts.map((post) => (
                      <button
                        key={post.slug}
                        type="button"
                        onClick={() => handleNavigateToPost(post)}
                        className="group flex w-full items-start gap-4 p-4 rounded-xl bg-card border border-border/50 hover:border-primary/30 hover:shadow-lg transition-all text-left"
                      >
                        <div className="mt-1.5 h-2 w-2 rounded-full bg-primary group-hover:shadow-[0_0_8px_rgba(59,130,246,0.5)] transition-shadow" />
                        <div className="flex-1 space-y-1.5">
                          <h4 className="font-semibold text-foreground leading-snug group-hover:text-primary transition-colors">
                            {post.title}
                          </h4>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span className="font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">{post.category}</span>
                            <span>{post.readTime}</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-6 rounded-2xl bg-gradient-to-br from-muted/50 to-muted border border-border/50">
                  <div className="flex items-center gap-2 text-foreground font-bold text-lg mb-4">
                    <Tag className="h-5 w-5 text-primary" />
                    <h3>Tags em alta</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {topTags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs font-medium px-3 py-1.5 rounded-full bg-background border border-border text-muted-foreground hover:bg-primary hover:text-white hover:border-primary hover:shadow-md cursor-pointer transition-all"
                        onClick={() => {
                          setSearchTerm(tag);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              </aside>
            </div>
          ) : (
            <Card className="rounded-3xl border-dashed border-quantum-bright/40 bg-background/80 text-center py-16">
              <CardHeader className="space-y-4">
                <CardTitle className="text-2xl">Nenhum artigo encontrado</CardTitle>
                <CardDescription>
                  Ajuste os filtros ou busque por outro termo para encontrar novos conteúdos.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="quantum"
                  onClick={() => {
                    setSearchTerm("");
                    setActiveCategory("Todos");
                  }}
                >
                  Limpar filtros
                </Button>
              </CardContent>
            </Card>
          )}

          {remainingPosts.length > 0 && (
            <div className="space-y-12">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border/40 pb-6">
                <div>
                  <h3 className="text-3xl font-bold text-foreground">Mais artigos para você</h3>
                  <p className="text-muted-foreground mt-2 text-lg">
                    Continue explorando nossos conteúdos selecionados por especialistas.
                  </p>
                </div>
                <Button variant="outline" className="rounded-full px-6" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
                  Voltar ao topo
                </Button>
              </div>

              <div className="grid gap-x-8 gap-y-12 md:grid-cols-2 lg:grid-cols-3">
                {remainingPosts.map((post) => (
                  <Card
                    key={post.slug}
                    id={post.slug}
                    className="group relative flex flex-col overflow-hidden rounded-2xl border-border/50 bg-card hover:border-primary/50 hover:shadow-xl transition-all duration-300"
                  >
                    <div className="relative h-56 overflow-hidden">
                      {post.image ? (
                        <img
                          src={post.image}
                          alt={post.title}
                          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-full w-full bg-gradient-to-br from-gray-100 to-gray-200" aria-hidden />
                      )}

                      <div className="absolute top-4 left-4">
                        <span className="px-3 py-1 text-xs font-bold bg-white/90 backdrop-blur text-primary rounded-full shadow-sm uppercase tracking-wide">
                          {post.category}
                        </span>
                      </div>
                    </div>

                    <CardContent className="flex flex-col flex-1 p-6 space-y-4">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground font-medium">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatPostDateTime(post.date)}
                        </span>
                        <span className="h-1 w-1 rounded-full bg-border" />
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {post.readTime}
                        </span>
                      </div>

                      <div className="block group-hover:cursor-pointer" onClick={() => handleNavigateToPost(post)}>
                        <h4 className="text-xl font-bold leading-snug group-hover:text-primary transition-colors mb-2">
                          {post.title}
                        </h4>
                        <p className="text-muted-foreground text-sm line-clamp-3 leading-relaxed">
                          {post.description}
                        </p>
                      </div>

                      <div className="mt-auto pt-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                            {post.author.charAt(0)}
                          </div>
                          <span className="text-xs font-medium text-muted-foreground">{post.author}</span>
                        </div>
                        <Button variant="ghost" className="p-0 h-auto font-semibold text-primary hover:text-primary/80 hover:bg-transparent group-hover/btn:translate-x-1 transition-all" onClick={() => handleNavigateToPost(post)}>
                          Ler completo <ArrowRight className="h-4 w-4 ml-1" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default BlogPage;
