[![npm version](https://badge.fury.io/js/angular2-expandable-list.svg)](https://badge.fury.io/js/angular2-expandable-list)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)

# anatomica-server

> An ExpressJS application for building a REST API that is used in Anatomica services.

## Prerequisites

This project requires NodeJS (version 14 or later) and NPM.
[Node](http://nodejs.org/) and [NPM](https://npmjs.org/) are really easy to install.
To make sure you have them available on your machine,
try running the following command.

```sh
$ npm -v && node -v
8.11.0
v16.16.0
```

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes. See deployment for notes on how to deploy the project on a live system.

## Installation

Start with cloning this repo on your local machine:

```sh
$ git clone https://github.com/ahmetozrahat/anatomica-server
$ cd anatomica-server
```

To install and set up the project, run:

```sh
$ npm install 
```

## Docker

In order to create docker image run the following command:

```sh
$ docker build -t your-username/anatomica-server
```

And run the blow code for creating a container running the image we previously built.

```sh
$ docker run -p 8080:8080 {image}
```

