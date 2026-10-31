# Makefile for MediCore Hospital Management System (C++17)

CXX ?= g++
CXXFLAGS = -std=c++17 -Wall -Wextra -O2 -Iinclude

ifeq ($(OS),Windows_NT)
    LIBS = -lws2_32
    TARGET = medicore_server.exe
else
    LIBS = -lpthread
    TARGET = medicore_server
endif

SRCS = server.cpp
OBJS = $(SRCS:.cpp=.o)

all: $(TARGET)

$(TARGET): $(SRCS)
	$(CXX) $(CXXFLAGS) -o $(TARGET) $(SRCS) $(LIBS)

clean:
	rm -f $(TARGET) *.o

.PHONY: all clean
