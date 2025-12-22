import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Header } from '@/components/header';
import { api } from '@/lib/api';
import { Product, Review, Store } from '@/types';
import { useAuth } from '@/hooks/use-auth';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { brandYellow } from '@/constants/theme';

export default function ProductDetailScreen() {
  const { productId } = useLocalSearchParams<{ productId: string }>();
  const { user } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [existingReview, setExistingReview] = useState<Review | null>(null);
  const [isOwner, setIsOwner] = useState(false);

  const load = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    try {
      const p = await api.get<Product>(`/products/${productId}`);
      const r = await api.get<Review[]>(`/products/${productId}/reviews`);
      setProduct(p);
      setReviews(r);
      if (user?.id) {
        const mine = r.find((rev) => rev.user.id === user.id);
        setExistingReview(mine ?? null);
      } else {
        setExistingReview(null);
      }

      // Determine if current user owns the store for this product
      if (user?.token && user.id && p.store) {
        try {
          const store = await api.get<Store>(`/stores/id/${p.store}`, user.token);
          setIsOwner(store.owner?.toString?.() === user.id);
        } catch {
          setIsOwner(false);
        }
      } else {
        setIsOwner(false);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to load product');
    } finally {
      setLoading(false);
    }
  }, [productId, user?.id, user?.token]);

  useEffect(() => {
    load();
  }, [load]);

  const submitReview = async () => {
    if (!user?.token) {
      return Alert.alert('Login required', 'Please log in to leave a review');
    }
    if (isOwner) {
      return Alert.alert('Not allowed', 'You cannot review your own product');
    }
    if (rating < 1 || rating > 5) {
      return Alert.alert('Rating required', 'Please select a rating');
    }
    if (existingReview) {
      return Alert.alert('Review exists', 'You have already reviewed this product');
    }

    try {
      setSubmitting(true);
      await api.post(`/products/${productId}/reviews`, { rating, comment: comment.trim() }, user.token);
      setComment('');
      setRating(0);
      // optimistic: append new review
      setExistingReview({
        _id: 'temp',
        product: productId,
        user: { id: user.id, name: user.name ?? 'You', email: user.email ?? '' },
        rating,
        comment: comment.trim(),
        createdAt: new Date().toISOString(),
      });
      setReviews((prev) => [
        ...prev,
        {
          _id: 'temp',
          product: productId,
          user: { id: user.id, name: user.name ?? 'You', email: user.email ?? '' },
          rating,
          comment: comment.trim(),
          createdAt: new Date().toISOString(),
        },
      ]);
      load(); // Reload to get updated reviews and stats
      Alert.alert('Success', 'Review submitted');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <Header showSearch />
        <ThemedText style={styles.loadingText}>Loading…</ThemedText>
      </ThemedView>
    );
  }

  if (!product) {
    return (
      <ThemedView style={styles.container}>
        <Header showSearch />
        <ThemedText style={styles.loadingText}>Product not found</ThemedText>
      </ThemedView>
    );
  }

  const stars = Math.round(product.averageRating || 0);

  return (
    <ThemedView style={styles.container}>
      <Header showSearch />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {product.images && product.images[0] ? (
          <Image source={{ uri: product.images[0] }} style={styles.productImage} />
        ) : (
          <View style={[styles.productImage, styles.imagePlaceholder]}>
            <IconSymbol name="photo" size={60} color="#ccc" />
          </View>
        )}

        <View style={styles.content}>
          <ThemedText style={styles.productName}>{product.title}</ThemedText>
          <ThemedText style={styles.productPrice}>{`$${product.price.toFixed(2)}`}</ThemedText>

          <View style={styles.ratingSection}>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((i) => (
                <MaterialIcons
                  key={i}
                  name={i <= stars ? 'star' : 'star-border'}
                  size={22}
                  color={i <= stars ? brandYellow : '#ccc'}
                />
              ))}
            </View>
            <ThemedText style={styles.ratingText}>
              {`${product.averageRating?.toFixed(1) || '0.0'} (${product.reviewCount || 0} reviews)`}
            </ThemedText>
          </View>

          {product.description && (
            <ThemedText style={styles.description}>{product.description}</ThemedText>
          )}

          {user?.token && !isOwner && !existingReview && (
            <View style={styles.reviewForm}>
              <ThemedText style={styles.formTitle}>Write a Review</ThemedText>
              <View style={styles.ratingInput}>
                <ThemedText style={styles.ratingLabel}>Rating:</ThemedText>
                <View style={styles.starsInput}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Pressable key={i} onPress={() => setRating(i)}>
                      <MaterialIcons
                        name={i <= rating ? 'star' : 'star-border'}
                        size={28}
                        color={i <= rating ? brandYellow : '#ccc'}
                      />
                    </Pressable>
                  ))}
                </View>
              </View>
              <TextInput
                style={styles.commentInput}
                placeholder="Write your review..."
                value={comment}
                onChangeText={setComment}
                multiline
                numberOfLines={4}
              />
              <Pressable
                style={[styles.submitButton, submitting && styles.buttonDisabled]}
                onPress={submitReview}
                disabled={submitting}
              >
                <ThemedText style={styles.submitButtonText}>
                  {submitting ? 'Submitting…' : 'Submit Review'}
                </ThemedText>
              </Pressable>
            </View>
          )}
          {user?.token && isOwner && (
            <View style={styles.infoBox}>
              <ThemedText style={styles.infoText}>You can view your product reviews but cannot rate your own product.</ThemedText>
            </View>
          )}
          {user?.token && existingReview && !isOwner && (
            <View style={styles.infoBox}>
              <ThemedText style={styles.infoText}>You already reviewed this product.</ThemedText>
            </View>
          )}

          <View style={styles.reviewsSection}>
            <ThemedText style={styles.sectionTitle}>{`Reviews (${reviews.length})`}</ThemedText>
            {reviews.length === 0 ? (
              <ThemedText style={styles.noReviews}>No reviews yet</ThemedText>
            ) : (
              reviews.map((review) => (
                <View key={review._id} style={styles.reviewCard}>
                  <View style={styles.reviewHeader}>
                    <ThemedText style={styles.reviewerName}>{review.user.name}</ThemedText>
                    <View style={styles.reviewStars}>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <MaterialIcons
                          key={i}
                          name={i <= review.rating ? 'star' : 'star-border'}
                          size={14}
                          color={i <= review.rating ? brandYellow : '#ccc'}
                        />
                      ))}
                    </View>
                  </View>
                  {review.comment && (
                    <ThemedText style={styles.reviewComment}>{review.comment}</ThemedText>
                  )}
                  <ThemedText style={styles.reviewDate}>
                    {new Date(review.createdAt).toLocaleDateString()}
                  </ThemedText>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFEF9',
  },
  scrollContent: {
    paddingBottom: 20,
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 40,
    color: '#666',
  },
  productImage: {
    width: '100%',
    height: 400,
    backgroundColor: '#f0f0f0',
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 16,
  },
  productName: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  productPrice: {
    fontSize: 28,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  ratingSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  stars: {
    flexDirection: 'row',
    gap: 4,
  },
  ratingText: {
    fontSize: 16,
    color: '#666',
  },
  description: {
    fontSize: 16,
    color: '#1A1A1A',
    lineHeight: 24,
    marginBottom: 24,
  },
  reviewForm: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  ratingInput: {
    marginBottom: 12,
  },
  ratingLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  starsInput: {
    flexDirection: 'row',
    gap: 8,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: brandYellow,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#1A1A1A',
    fontWeight: '600',
    fontSize: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  reviewsSection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  noReviews: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    padding: 20,
  },
  reviewCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  reviewStars: {
    flexDirection: 'row',
    gap: 2,
  },
  infoBox: {
    backgroundColor: '#FFF7D6',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  infoText: {
    color: '#6A6A6A',
    fontSize: 14,
    lineHeight: 20,
  },
  reviewComment: {
    fontSize: 14,
    color: '#1A1A1A',
    lineHeight: 20,
    marginBottom: 8,
  },
  reviewDate: {
    fontSize: 12,
    color: '#999',
  },
});

